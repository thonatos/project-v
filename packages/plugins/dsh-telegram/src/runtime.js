import { randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { basename, isAbsolute, resolve as resolvePath, sep } from 'node:path';
import { normalizeConfig, resolveCredentials } from './config.js';
import { createTranslator, translate } from './i18n/index.js';
import { normalizeInboundMessage, splitMessageText } from './transport/inbound.js';
import { openBindingStore } from './persist.js';
import { createTelegramClient, TELEGRAM_COMMAND_NAMES } from './transport/client.js';
import { createTelegramTransport, TELEGRAM_MEDIA_LIMIT } from './transport/transport.js';
import { StreamSession } from './render/stream.js';
import {
  approvalCard,
  classifyContent,
  controlCard,
  interactionCard,
  modelListChunks,
  statusCard,
  workspaceCard,
} from './render/cards.js';
import { extractLocalImageLinks, extractLocalImagePaths } from './render/local-images.js';
import { stripImageMarkdown } from './render/html.js';
import {
  buildAgentSetup,
  installAgentBridges,
  installAgentModelSelection,
  stopAgentTurn,
} from './agent/integration.js';

export class TelegramRuntime {
  #ctx;
  #config;
  // 聊天文案翻译器：由 config.language 建立，贯穿卡片、命令回执与错误兜底。
  #t;
  #credentials;
  #workspaceRegistry;
  #storageDomain;
  #connection;
  #transport;
  #bindings;
  #sessionHandles = new Map();
  #inflight = new Map();
  #activeTurns = new Map();
  #cancelledChats = new Set();
  #stopping = new Set();
  #interactions = new Map();
  // 待决审批：approvalId -> { chatId, messageId, settle(outcome), settled }。
  // approval/request 挂起时登记，回调点击或 signal abort 时 settle。
  #approvals = new Map();
  #streams = new Map();
  #reactions = new Map();
  // 已在其 agent-scoped ctx 上装好桥接（session 事件流/审批/交互）的 sessionId 集合。
  // 「复用已存活 agent」路径不跑 setup，需在此补装；用集合去重避免同一 agent 重复注册。
  #bridged = new Set();
  // sessionId -> ModelSelectionRef。/model 切换时改写对应 ref 的 current，
  // 使当前会话的下一个 step 使用新模型（历史保留、不新建 Session）。
  #selections = new Map();
  #remoteInteractionDisposers = [];
  #stopped = false;

  constructor(ctx, config, { createClient = createTelegramClient, openStore = openBindingStore } = {}) {
    this.#ctx = ctx;
    this.#config = normalizeConfig(config);
    this.#t = createTranslator(this.#config.language);
    this.#credentials = ctx.credentials;
    this.#workspaceRegistry = ctx.workspaceRegistry;
    // 会话绑定持久化走 dsh 官方 storage 子系统（ctx.storageDomain），由 backend
    // 负责落盘位置与原子写；插件不再自行选择文件路径。
    this.#storageDomain = ctx.storageDomain;
    this.#createClient = createClient;
    this.#openStore = openStore;
  }

  #createClient;
  #openStore;

  async start() {
    const workspace = this.#workspaceRegistry?.get(this.#config.workspaceId);
    if (!workspace) throw new Error('Telegram workspaceId does not resolve to a registered Workspace');
    if ((await workspace.status()) !== 'ok') throw new Error('Telegram Workspace directory is unavailable');
    const credentials = await resolveCredentials(this.#credentials);
    this.#bindings = await this.#openStore(this.#storageDomain);
    this.#connection = await this.#createClient({
      ...credentials,
      ownerUserId: this.#config.ownerUserId,
      proxy: this.#config.proxy,
      // 命令菜单描述与聊天文案同语言（Telegram 侧的命令列表在注册时定稿）。
      t: this.#t,
      onMessage: (event) => this.#handleMessage(event),
      onCallbackQuery: (event) => this.#handleCallbackQuery(event),
    });
    this.#transport = createTelegramTransport(this.#connection);
    this.#installRemoteInteractionBridges();
    this.#ctx.effect?.(() => () => this.stop());
    return this;
  }

  async stop() {
    if (this.#stopped) return;
    this.#stopped = true;
    for (const handle of this.#sessionHandles.values()) await handle.dispose?.();
    this.#sessionHandles.clear();
    this.#selections.clear();
    this.#inflight.clear();
    this.#activeTurns.clear();
    this.#cancelledChats.clear();
    this.#stopping.clear();
    // 关闭时把所有待决审批 settle 成 cancelled，让挂起的 answerer 立即返回，
    // 不残留永久 pending 的 Promise。
    for (const approval of this.#approvals.values()) approval.settle?.('cancelled');
    this.#approvals.clear();
    for (const interaction of this.#interactions.values()) interaction.cancel?.();
    this.#interactions.clear();
    for (const dispose of this.#remoteInteractionDisposers.splice(0)) dispose?.();
    for (const stream of this.#streams.values()) await stream.dispose?.();
    this.#streams.clear();
    await this.#connection?.close?.();
    this.#connection = null;
    this.#transport = null;
    await this.#bindings?.close?.();
    this.#bindings = null;
  }

  // 等待某个聊天（或全部聊天）在途的普通消息处理排空。
  // 普通消息在 #handleMessage 中不被 await（避免阻塞 SDK 事件循环），
  // 该方法给测试与优雅关闭提供一个可等待的同步点。
  async whenSettled(chatId) {
    if (chatId !== undefined) {
      await this.#inflight.get(String(chatId));
      return;
    }
    await Promise.all(this.#inflight.values());
  }

  async #handleMessage(event) {
    if (this.#stopped) return;
    const message = event?.message;
    if (
      !message?.isPrivate ||
      String(message.senderId) !== this.#config.ownerUserId ||
      String(message.senderId) === this.#connection.botId
    ) {
      return;
    }
    const chatId = String(message.chatId ?? message.senderId);
    const pending = this.#pendingInteraction(chatId);
    if (pending && message.message && !parseCommand(message.message)) {
      await this.#respondToInteraction(pending, { kind: 'text', value: message.message });
      return;
    }
    const command = parseCommand(message.message ?? '');
    if (command?.name === 'stop') {
      await this.#stopImmediately(chatId);
      return;
    }
    // 用 reaction 给出「已收到、处理中」的即时反馈；处理完成后由 #processMessage
    // 的 finally 通过 #clearSeen 清除。放在入队前，确保每条打了标记的消息都必经清除。
    this.#markSeen(chatId, message.messageId);
    // 普通消息进入每个聊天自己的串行队列，但 handler 本身不 await —— 否则会
    // 阻塞 Bot SDK 的 message 事件循环，令后续 /stop 等 fast-path 命令排在长任务
    // 之后才被处理。立即返回后，SDK 能马上投递下一条消息（含控制命令）。
    const previous = this.#inflight.get(chatId) ?? Promise.resolve();
    const current = previous.then(() => this.#processMessage(chatId, message));
    const tracked = current.catch(() => {});
    this.#inflight.set(chatId, tracked);
    void tracked.finally(() => {
      if (this.#inflight.get(chatId) === tracked) this.#inflight.delete(chatId);
    });
  }

  // 给收到的消息打上 👀 reaction 作为「处理中」的即时反馈。fire-and-forget：
  // reaction 不是关键路径，失败仅记日志，绝不阻塞消息处理。记录设置 promise，
  // 供 #clearSeen 串接，避免「设置」与「清除」两个请求乱序导致 👀 残留。
  #markSeen(chatId, messageId) {
    if (!messageId || typeof this.#transport.setReaction !== 'function') return;
    const set = this.#transport.setReaction(chatId, messageId, '👀').catch((error) => {
      console.error('[dsh-telegram] set reaction failed:', error);
    });
    this.#reactions.set(`${chatId}:${messageId}`, set);
  }

  // 处理完成后清除该消息的 reaction。链在设置 promise 之后，保证顺序。
  async #clearSeen(chatId, messageId) {
    const key = `${chatId}:${messageId}`;
    const pending = this.#reactions.get(key);
    if (pending === undefined) return;
    this.#reactions.delete(key);
    try {
      await pending;
      await this.#transport.setReaction(chatId, messageId, '');
    } catch (error) {
      console.error('[dsh-telegram] clear reaction failed:', error);
    }
  }

  async #handleCallbackQuery(event) {
    const callback = event?.callback;
    if (!callback || String(callback.senderId) !== this.#config.ownerUserId) return;
    const [prefix, kind, interactionId, encodedValue] = String(callback.data ?? '').split(':');
    let value = '';
    try {
      value = encodedValue ? decodeURIComponent(encodedValue) : '';
    } catch {
      await this.#transport.answerCallback(callback.id, this.#t('callback.invalid'));
      return;
    }
    if (prefix !== 'dsh' || !kind || !interactionId || !value) {
      await this.#transport.answerCallback(callback.id, this.#t('callback.invalid'));
      return;
    }
    if (kind === 'workspace' && interactionId === 'select') {
      let workspace;
      try {
        workspace = await this.#switchWorkspace(String(callback.chatId), value);
      } catch {
        await this.#transport.answerCallback(callback.id, this.#t('callback.workspaceUnavailable'));
        return;
      }
      await this.#transport
        .editCard(callback.chatId, callback.messageId, { inline_keyboard: [] })
        .catch((error) => console.error('[dsh-telegram] workspace card cleanup failed:', error));
      await this.#transport.answerCallback(
        callback.id,
        this.#t('callback.workspaceSwitched', { title: workspace.title }),
      );
      return;
    }
    // 审批点击：settle 对应的挂起 answerer。approval 走 #approvals，与 interaction 分离。
    if (kind === 'approval') {
      const approval = this.#approvals.get(interactionId);
      if (!approval || approval.chatId !== String(callback.chatId)) {
        await this.#transport.answerCallback(callback.id, this.#t('callback.approvalExpired'));
        return;
      }
      const outcome = value === 'approve' ? 'allowed-once' : 'rejected';
      approval.settle(outcome);
      await this.#transport.answerCallback(
        callback.id,
        value === 'approve' ? this.#t('callback.approved') : this.#t('callback.rejected'),
      );
      return;
    }
    const interaction = this.#interactions.get(interactionId);
    if (!interaction || interaction.chatId !== String(callback.chatId)) {
      await this.#transport.answerCallback(callback.id, this.#t('callback.interactionExpired'));
      return;
    }
    try {
      const resolvedValue = kind === 'question' ? interaction.values?.[Number(value)] : value;
      if (kind === 'question' && resolvedValue === undefined) throw new Error('question option is unavailable');
      await this.#respondToInteraction(interaction, { kind, value: resolvedValue });
      await this.#transport.answerCallback(callback.id, this.#t('callback.submitted'));
    } catch (error) {
      console.error('[dsh-telegram] interaction response failed:', error);
      await this.#transport.answerCallback(callback.id, this.#t('callback.submitFailed'));
    }
  }

  #pendingInteraction(chatId) {
    return [...this.#interactions.values()].find((interaction) => interaction.chatId === chatId);
  }

  #hasPendingApproval(chatId) {
    return [...this.#approvals.values()].some((approval) => approval.chatId === chatId);
  }

  async #respondToInteraction(interaction, answer) {
    if (typeof interaction.respond !== 'function') throw new Error('interaction response is unavailable');
    await interaction.respond(answer);
    await this.#transport.editCard(interaction.chatId, interaction.messageId, { inline_keyboard: [] });
    this.#interactions.delete(interaction.id);
  }

  async #processMessage(chatId, message) {
    const inbound = normalizeInboundMessage(message, {
      loadMedia: (value) => this.#transport.downloadMedia(value),
    });
    if (!inbound) return;
    try {
      const command = inbound.media ? null : parseCommand(inbound.text);
      if (command) {
        await this.#runCommand(chatId, command);
        return;
      }
      const handle = await this.#sessionFor(chatId);
      const content = await this.#contentFor(inbound);
      const messageCount = handle.agent.session?.deriveMessages?.().length ?? 0;
      this.#activeTurns.set(chatId, handle);
      // 为本次 turn 建立流式会话：session/event 增量事件由 #onSessionEvent 路由到它。
      const stream = new StreamSession({
        transport: this.#transport,
        chatId,
        limit: this.#config.messageLimit,
        t: this.#t,
      });
      this.#streams.set(chatId, stream);
      if (this.#cancelledChats.has(chatId)) return;
      const promptRpcId = `telegram-${randomUUID()}`;
      handle.agent.followup({
        id: promptRpcId,
        role: 'user',
        content,
        source: { kind: 'user', rpcId: promptRpcId },
      });
      await handle.agent.whenIdle?.();
      await stream.finalize();
      if (this.#cancelledChats.has(chatId)) return;
      const events = this.#finalAssistantEvents(handle.agent.session, messageCount);
      // dsh 0.1.5-rc.1 的最终消息可能已写入 Session，但 agent-scoped
      // session/event 未送达。仅在本 turn 没有流式正文时用最终消息补发，避免重复。
      if (!stream.hasTextOutput) {
        const text = events
          .filter((event) => event.type === 'text')
          .map((event) => event.text)
          .join('');
        if (text) {
          await stream.handleEvent({
            type: 'assistant/chunk',
            data: { chunk: { type: 'block-end', block: { type: 'text', text } } },
          });
          await stream.finalize();
        }
      }
      const promotedLocalImage = await this.#sendMediaArtifacts(chatId, events);
      if (promotedLocalImage) {
        for (const messageId of stream.messageIds) {
          if (!messageId) continue;
          await this.#transport
            .deleteMessage(chatId, messageId)
            .catch((error) => console.error('[dsh-telegram] rich message cleanup failed:', error));
        }
      }
    } catch (error) {
      console.error('[dsh-telegram] message processing failed:', error);
      await this.#sendText(chatId, userFacingError(error, this.#t));
    } finally {
      const stream = this.#streams.get(chatId);
      if (stream) {
        await stream.dispose?.();
        this.#streams.delete(chatId);
      }
      this.#activeTurns.delete(chatId);
      this.#cancelledChats.delete(chatId);
      await this.#clearSeen(chatId, message.messageId);
    }
  }

  async #stopImmediately(chatId) {
    if (this.#stopping.has(chatId)) return;
    const binding = this.#bindings.get(chatId);
    const fromActive = this.#activeTurns.get(chatId);
    const fromHandles = binding ? this.#sessionHandles.get(binding.sessionId) : undefined;
    const fromRegistry =
      binding && this.#ctx.agents.get?.(binding.sessionId)
        ? { agent: this.#ctx.agents.get(binding.sessionId), async dispose() {} }
        : undefined;
    const handle = fromActive ?? fromHandles ?? fromRegistry;
    if (!handle) {
      await this.#sendControlCard(chatId, 'stop', { message: this.#t('stop.none') });
      return;
    }
    this.#stopping.add(chatId);
    this.#cancelledChats.add(chatId);
    let stopped;
    try {
      stopped = await stopAgentTurn(handle.agent);
    } catch (error) {
      this.#cancelledChats.delete(chatId);
      this.#stopping.delete(chatId);
      throw error;
    }
    if (stopped === false) {
      this.#cancelledChats.delete(chatId);
      this.#stopping.delete(chatId);
      await this.#sendControlCard(chatId, 'stop', { message: this.#t('stop.none') });
      return;
    }
    await this.#sendControlCard(chatId, 'stop', { message: this.#t('stop.requested') });
    void Promise.resolve(handle.agent.whenIdle?.()).finally(() => this.#stopping.delete(chatId));
  }

  async #contentFor(inbound) {
    const blocks = [];
    if (inbound.text) blocks.push({ type: 'text', text: inbound.text });
    if (inbound.media) {
      const bytes = await inbound.media.load?.();
      if (!bytes) throw new Error('Telegram media could not be downloaded');
      if (!this.#ctx.attachments?.saveImage) throw new Error('dsh attachment service is required for Telegram images');
      const attachment = await this.#ctx.attachments.saveImage({
        data: bytes,
        mediaType: inbound.media.mimeType ?? 'image/jpeg',
        name: inbound.media.name,
      });
      blocks.push({ type: 'image', attachment });
    }
    return blocks;
  }

  async #runCommand(chatId, command) {
    if (command.name === 'unsupported') {
      await this.#sendControlCard(chatId, 'unsupported', {
        message: this.#t('help.unavailable'),
        detail: `${this.#t('help.commands')}${TELEGRAM_COMMAND_NAMES.join(this.#t('common.listSeparator'))}`,
      });
      return;
    }
    if (command.name === 'help') {
      await this.#sendControlCard(chatId, 'help', {
        message: this.#t('help.commands'),
        detail: TELEGRAM_COMMAND_NAMES.join('\n'),
      });
      return;
    }
    if (command.name === 'status') {
      const handle = await this.#sessionFor(chatId);
      const binding = this.#bindings.get(chatId);
      const workspaceId = binding?.workspaceId ?? this.#config.workspaceId;
      const workspace = this.#workspaceRegistry.get(workspaceId);
      const card = statusCard(
        {
          workspaceId,
          workspaceTitle: workspace?.title,
          sessionId: handle.agent.id,
          model: this.#effectiveSelection(handle.agent.id, chatId),
          active: this.#activeTurns.has(chatId),
          interactionPending: Boolean(this.#pendingInteraction(chatId)) || this.#hasPendingApproval(chatId),
        },
        this.#t,
      );
      await this.#sendCard(chatId, card.text, { parseMode: card.parseMode });
      return;
    }
    if (command.name === 'new') {
      const workspaceId = this.#bindings.get(chatId)?.workspaceId ?? this.#config.workspaceId;
      await this.#switchWorkspace(chatId, workspaceId);
      await this.#sendControlCard(chatId, 'new', { message: this.#t('session.created') });
      return;
    }
    if (command.name === 'workspace') {
      const workspaces = this.#workspaceRegistry.list();
      const currentWorkspaceId = this.#bindings.get(chatId)?.workspaceId ?? this.#config.workspaceId;
      const card = workspaceCard(workspaces, currentWorkspaceId, this.#t);
      await this.#sendCard(chatId, card.text, { parseMode: card.parseMode, replyMarkup: card.replyMarkup });
      return;
    }
    if (command.name === 'model') {
      await this.#runModelCommand(chatId, command.args ?? []);
      return;
    }
    // parseCommand 只产出 new/status/help/workspace/model/unsupported（均已 return）与 stop
    // （在 #handleMessage 的 fast-path 拦截），不会走到这里。
  }

  // /model：无参数列出目录，恰好两个参数执行切换，其余数量返回用法提示。
  async #runModelCommand(chatId, args) {
    if (args.length === 0) {
      await this.#sendModelList(chatId);
      return;
    }
    if (args.length !== 2) {
      await this.#sendControlCard(chatId, 'model', {
        message: this.#t('model.usage'),
        detail: '/model\n/model <provider> <model>',
      });
      return;
    }
    await this.#selectModel(chatId, args[0], args[1]);
  }

  // 模型清单按行分片后逐条发送，每行是一个「点击即复制」的完整 /model 命令。
  // 不走 #sendCard（不分片）也不走 #sendText（按字符切会劈断 HTML 标签）：
  // 分片以行为单位在 modelListChunks 内完成，保证每个 <code> 完整落在同一片内。
  async #sendModelList(chatId) {
    const handle = this.#sessionHandles.get(this.#bindings.get(chatId)?.sessionId ?? '');
    const current = this.#effectiveSelection(handle?.agent?.id, chatId);
    const providers = this.#ctx.llm?.listProviders?.() ?? [];
    const groups = [];
    for (const provider of providers) {
      const id = String(provider?.id ?? provider);
      try {
        const models = (await this.#ctx.llm.listModels(id)) ?? [];
        groups.push({ id, name: provider?.name, models: models.map((entry) => String(entry?.id ?? entry)) });
      } catch (error) {
        // 单个 provider 目录失败不得中断整个清单：就地标注并继续列出其余 provider。
        console.error(`[dsh-telegram] listModels failed for ${id}:`, error);
        groups.push({ id, name: provider?.name, error: userFacingError(error, this.#t) });
      }
    }
    for (const chunk of modelListChunks({ current, groups }, this.#config.messageLimit, this.#t)) {
      await this.#transport.sendText(chatId, chunk, { parseMode: 'HTML' });
    }
  }

  // 切换模型：校验通过后同时改 agent 级 ref（当前会话下一个 step 生效）与持久化绑定
  // （/new、切 Workspace、resume、重启后继续生效）。校验失败时两者均不动。
  async #selectModel(chatId, provider, model) {
    if (!(await this.#isRoutable(provider, model))) {
      await this.#sendControlCard(chatId, 'model', {
        message: this.#t('model.unavailable'),
        detail: `${provider} ${model}`,
      });
      return;
    }
    const handle = await this.#sessionFor(chatId);
    const ref = this.#selections.get(handle.agent.id);
    if (ref) ref.current = { provider, model };
    await this.#bindings.set(chatId, { provider, model });
    await this.#sendControlCard(chatId, 'model', {
      message: ref ? this.#t('model.switched.live') : this.#t('model.switched.new'),
      detail: `${provider} ${model}`,
    });
  }

  // 当前实际生效的选择：优先读 agent 级 ref（可能已被 /model 热改），
  // 回落绑定值。两者在正常路径下一致，但持久化选择失效并回落后会不一致。
  #effectiveSelection(agentId, chatId) {
    const ref = agentId ? this.#selections.get(agentId) : undefined;
    if (ref?.current?.provider && ref.current.model) {
      return { provider: ref.current.provider, model: ref.current.model };
    }
    return boundSelection(this.#bindings.get(chatId)) ?? this.#ctx.agentDefaultModel?.currentSelection?.();
  }

  async #sessionFor(chatId) {
    let current = this.#bindings.get(chatId);
    // 模型选择跟随聊天，而下面有三条分支会 delete 掉整条绑定后重建 Session。
    // 在任何 delete 之前先取出选择，重建时显式带回；只靠 persist 的 merge 不够，
    // 因为 delete 之后已无记录可 merge。
    const carried = boundSelection(current);
    let workspace;
    try {
      workspace = await this.#resolveWorkspace(current?.workspaceId ?? this.#config.workspaceId);
    } catch (error) {
      if (!current || current.workspaceId === this.#config.workspaceId) throw error;
      const stale = this.#sessionHandles.get(current.sessionId);
      await stale?.dispose?.();
      this.#sessionHandles.delete(current.sessionId);
      this.#bridged.delete(current.sessionId);
      await this.#bindings.delete(chatId);
      current = null;
      workspace = await this.#resolveWorkspace(this.#config.workspaceId);
    }
    if (current) {
      const existing = this.#sessionHandles.get(current.sessionId);
      if (existing && String(existing.agent.session?.header?.cwd) === String(workspace.path)) return existing;
      if (existing) {
        await existing.dispose?.();
        this.#sessionHandles.delete(current.sessionId);
        this.#bridged.delete(current.sessionId);
      }
      const live = this.#ctx.agents.get?.(current.sessionId);
      if (live && String(live.session?.header?.cwd) === String(workspace.path)) {
        const handle = { agent: live, async dispose() {} };
        this.#sessionHandles.set(current.sessionId, handle);
        // 复用注册表里的裸 agent：setup 不会再跑，必须在其 agent-scoped ctx 上补装桥接，
        // 否则 session/event 不路由到 StreamSession（正文丢失）、审批/交互也收不到。
        // 模型选择 ref 同理必须补装，否则 /model 对复用路径上的会话无效。
        this.#ensureBridges(chatId, live, await this.#resolveSelection(chatId));
        return handle;
      }
      // resume 失败会删除绑定并重建；模型选择已在函数入口记下（carried）。
      let resumed;
      try {
        // resume 侧与 create 侧一致地传入 agentOptions（provider/model 快照）：
        // 这是 dsh 官方防止 provider/model 漂移的机制。快照来源为私聊级选择，
        // 无私聊级选择时回落 agentDefaultModel.currentSelection()。
        const selection = await this.#resolveSelection(chatId);
        resumed = await this.#ctx.agents.resume({
          resumeSessionId: current.sessionId,
          ...(selection ? { agentOptions: { provider: selection.provider, model: selection.model } } : {}),
          setup: this.#buildAgentSetup(chatId, selection, current.sessionId),
        });
      } catch {
        await this.#bindings.delete(chatId);
        resumed = undefined;
      }
      if (!resumed) return this.#rebuildSession(chatId, workspace, carried);
      if (String(resumed.agent.session.header.cwd) !== String(workspace.path)) {
        await resumed.dispose();
        await this.#bindings.delete(chatId);
      } else {
        this.#sessionHandles.set(current.sessionId, resumed);
        // resume 的 setup 已装好桥接：登记以防其后走「复用 live agent」路径时重复注册。
        this.#bridged.add(resumed.agent.id);
        return resumed;
      }
    }
    return this.#rebuildSession(chatId, workspace, carried);
  }

  // 建立新 Session 并写回绑定。carried 为进入本次解析时的模型选择：上游多条分支会
  // delete 掉整条绑定，因此这里必须显式带回，不能依赖 persist 的 merge。
  async #rebuildSession(chatId, workspace, carried) {
    const handle = await this.#createSession(chatId, workspace, carried);
    await this.#bindings.set(chatId, {
      sessionId: handle.agent.id,
      workspaceId: String(workspace.id),
      ...carried,
    });
    return handle;
  }

  async #resolveWorkspace(workspaceId) {
    const workspace = this.#workspaceRegistry.get(workspaceId);
    if (!workspace || (await workspace.status()) !== 'ok') {
      throw new Error('Telegram Workspace is not registered or unavailable');
    }
    return workspace;
  }

  async #switchWorkspace(chatId, workspaceId) {
    const workspace = await this.#resolveWorkspace(workspaceId);
    const previous = this.#bindings.get(chatId);
    // 模型选择跟随聊天而非 Workspace：新 Session 必须带着当前选择创建。
    // 绑定侧无需显式带回 —— 该路径不 delete，persist 的 merge 语义已保住这两个字段。
    const carried = boundSelection(previous);
    const handle = await this.#createSession(chatId, workspace, carried);
    try {
      await this.#bindings.set(chatId, {
        sessionId: handle.agent.id,
        workspaceId: String(workspace.id),
      });
    } catch (error) {
      await handle.dispose?.();
      this.#sessionHandles.delete(handle.agent.id);
      this.#bridged.delete(handle.agent.id);
      throw error;
    }
    if (previous) {
      const previousHandle = this.#sessionHandles.get(previous.sessionId);
      await previousHandle?.dispose?.();
      this.#sessionHandles.delete(previous.sessionId);
      this.#bridged.delete(previous.sessionId);
      this.#selections.delete(previous.sessionId);
    }
    return workspace;
  }

  // 解析本聊天当前应使用的模型选择：私聊级绑定优先，否则回落 dsh 全局默认。
  // 绑定里的选择若已不可路由，回落全局默认并提示一次（不静默降级）。
  async #resolveSelection(chatId) {
    const bound = boundSelection(this.#bindings.get(chatId));
    if (bound) {
      if (await this.#isRoutable(bound.provider, bound.model)) return { ...bound };
      await this.#sendControlCard(chatId, 'model', {
        message: this.#t('model.fallback'),
        detail: `${bound.provider} ${bound.model}`,
      }).catch((error) => console.error('[dsh-telegram] stale model notice failed:', error));
    }
    const fallback = this.#ctx.agentDefaultModel?.currentSelection?.();
    return fallback ? { provider: fallback.provider, model: fallback.model } : undefined;
  }

  // 校验一个 provider/model 路由是否可用。dsh 明确规定模型目录是 advisory 且不控制
  // 路由，因此校验必须问具体路由（resolveModelInfo），不能用 listModels 当白名单。
  async #isRoutable(provider, model) {
    if (typeof this.#ctx.llm?.resolveModelInfo !== 'function') return true;
    try {
      await this.#ctx.llm.resolveModelInfo(provider, model);
      return true;
    } catch {
      return false;
    }
  }

  // 本插件依赖的 agent-scoped 桥接参数（交互/审批/session 事件流）。
  // create/resume 的 setup 与「复用已存活 agent」两条路径共用同一组回调。
  #bridgeArgs(chatId) {
    return {
      onInteractionRequested: (interaction) => this.#handleInteraction(chatId, interaction),
      onInteractionResolved: (interaction) => this.#resolveInteraction(interaction),
      onUserQuestionsRequested: (request) => this.#handleUserQuestions(chatId, request),
      onApprovalRequested: (req) => this.#handleApproval(chatId, req),
      onSessionEvent: (event) => this.#onSessionEvent(chatId, event),
    };
  }

  // 在已存活 agent 的 agent-scoped ctx 上补装桥接与模型选择（仅首次；用 #bridged 去重）。
  #ensureBridges(chatId, agent, selection) {
    const id = agent?.id ?? '';
    if (!id || this.#bridged.has(id)) return;
    const agentCtx = agent?.ctx;
    if (typeof agentCtx?.on !== 'function') return;
    installAgentBridges(agentCtx, this.#bridgeArgs(chatId));
    this.#installSelection(agentCtx, id, selection);
    this.#bridged.add(id);
  }

  // 安装 agent 级可变模型选择，并登记 ref 供 /model 热切换写入。
  // 这是「切换后当前会话立刻生效」的唯一机制，细节见 agent/integration.js。
  #installSelection(agentCtx, agentId, selection) {
    if (!agentId) return;
    const ref = installAgentModelSelection(agentCtx, selection);
    if (ref) this.#selections.set(String(agentId), ref);
  }

  // 构造 agent 的 setup 回调，create 与 resume 共用。具体注入逻辑见 agent/integration.js。
  // agentOptions 提供创建时的初始快照，ModelSelectionRef 提供后续 step 的可变来源；
  // 两者由同一个 selection 值喂入以保持同源。preset 通过官方 ctx.agentPresets.mount 挂载。
  // sessionId 由调用方给出（create 侧自行生成、resume 侧即 resumeSessionId），
  // 因为 setup 在 agent 发布前执行，不能依赖 agent 参数一定带 id。
  #buildAgentSetup(chatId, selection, sessionId) {
    const presets = this.#ctx.agentPresets;
    return buildAgentSetup({
      mountPreset: presets?.mount ? (agentCtx) => presets.mount(agentCtx, undefined) : undefined,
      installSelection: (agentCtx, agent) => this.#installSelection(agentCtx, agent?.id ?? sessionId, selection),
      ...this.#bridgeArgs(chatId),
    });
  }

  async #createSession(chatId, workspace, selection) {
    const resolved = selection ?? (await this.#resolveSelection(chatId));
    const sessionId = `telegram-${randomUUID()}`;
    const handle = await this.#ctx.agents.create({
      sessionId,
      meta: { cwd: workspace.path },
      ...(resolved ? { agentOptions: { provider: resolved.provider, model: resolved.model } } : {}),
      setup: this.#buildAgentSetup(chatId, resolved, sessionId),
    });
    try {
      await workspace.attachSession(handle.agent.id);
    } catch (error) {
      await handle.dispose?.();
      throw error;
    }
    this.#sessionHandles.set(handle.agent.id, handle);
    // create 的 setup 已装好桥接：登记以防其后走「复用 live agent」路径时重复注册。
    this.#bridged.add(handle.agent.id);
    return handle;
  }

  async #sendText(chatId, text) {
    for (const chunk of splitMessageText(text, this.#config.messageLimit)) {
      await this.#transport.sendText(chatId, chunk);
    }
  }

  // 把某聊天当前 turn 的 session 增量事件转给它的 StreamSession。
  #onSessionEvent(chatId, event) {
    const stream = this.#streams.get(chatId);
    if (!stream) return;
    void stream.handleEvent(event);
  }

  #finalAssistantEvents(session, messageCount) {
    const messages = session?.deriveMessages?.() ?? [];
    const assistant = messages
      .slice(messageCount)
      .reverse()
      .find((message) => message?.role === 'assistant');
    return classifyContent(assistant?.content ?? []);
  }

  // 文本已由流式事件或最终消息兜底交付；这里只补发 Harness 登记的媒体产物（图片等）。
  async #sendMediaArtifacts(chatId, events) {
    const caption = events
      .filter((event) => event.type === 'text')
      .map((event) => event.text)
      .join('');
    for (const event of events) {
      if (event.type !== 'media') continue;
      const { kind, block } = event;
      const read =
        this.#ctx.attachments?.[`read${capitalize(kind)}`] ??
        (kind === 'document' ? this.#ctx.attachments?.readFile : undefined) ??
        (kind === 'image' ? this.#ctx.attachments?.readImage : undefined);
      if (typeof read !== 'function') {
        await this.#sendText(chatId, this.#t('media.unsupported', { kind }));
        continue;
      }
      try {
        const stored = await read(block.attachment ?? block.artifact);
        await this.#transport.sendMedia(chatId, stored.data, {
          kind,
          caption,
          fileName: block.attachment?.name ?? block.artifact?.name ?? `telegram-${kind}`,
        });
      } catch (error) {
        console.error('[dsh-telegram] media delivery failed:', error);
        await this.#sendText(
          chatId,
          this.#t('media.unsupported.reason', { kind, reason: userFacingError(error, this.#t) }),
        );
      }
    }
    // 补发正文里以 markdown `![](本地路径)` 内联的图片（agent 未登记为 attachment
    // 时的降级路径）。仅限当前 workspace 目录内、扩展名为图片的文件，且经 realpath
    // 校验防目录穿越。
    return this.#sendLocalImages(chatId, caption);
  }

  // 扫描正文里的本地图片路径，安全校验后读取并作为独立图片发送。
  async #sendLocalImages(chatId, text) {
    const paths = extractLocalImagePaths(text);
    if (paths.length === 0) return false;
    const linkedPaths = new Set(extractLocalImageLinks(text));
    const workspaceId = this.#bindings.get(chatId)?.workspaceId ?? this.#config.workspaceId;
    const workspace = this.#workspaceRegistry.get(workspaceId);
    if (!workspace?.path) return false;
    let root;
    try {
      root = await realpath(workspace.path);
    } catch {
      return false;
    }
    // 已发送的真实路径集合，按 realpath 去重（见循环内说明）。
    const sent = new Set();
    const caption = stripImageMarkdown(text).trim();
    let promoted = false;
    for (const rawPath of paths) {
      // 相对路径按 workspace 根解析；绝对路径原样。随后 realpath 归一并校验包含关系。
      const candidate = isAbsolute(rawPath) ? rawPath : resolvePath(root, rawPath);
      let real;
      try {
        real = await realpath(candidate);
      } catch {
        // 文件不存在或无法解析：跳过，不打扰用户（正文文本已交付）。
        continue;
      }
      // 严格包含校验：real 必须等于 root 或位于 root 之下（以 root + 分隔符 开头），
      // 阻断 `../` 穿越与前缀同名目录（如 /ws-evil 冒充 /ws）。
      if (real !== root && !real.startsWith(root + sep)) continue;
      // 按 realpath 去重：同一文件常被正文以多种写法引用（如 `pic.png` 与
      // `/abs/pic.png`），extractLocalImagePaths 视为不同字符串，realpath 后归一到同一
      // 真实路径，避免同图重复发送。
      if (sent.has(real)) continue;
      sent.add(real);
      try {
        const bytes = await readFile(real);
        if (bytes.byteLength > TELEGRAM_MEDIA_LIMIT) {
          await this.#sendText(chatId, this.#t('media.image.tooLarge', { name: basename(real) }));
          continue;
        }
        await this.#transport.sendMedia(chatId, bytes, {
          kind: 'image',
          fileName: basename(real),
          caption: linkedPaths.has(rawPath) && !promoted ? caption : '',
        });
        promoted ||= linkedPaths.has(rawPath);
      } catch (error) {
        console.error('[dsh-telegram] local image delivery failed:', error);
        await this.#sendText(chatId, this.#t('media.image.failed', { reason: userFacingError(error, this.#t) }));
      }
    }
    return promoted;
  }

  async #sendCard(chatId, text, interaction) {
    const sent = await this.#transport.sendCard(chatId, text, {
      replyMarkup: interaction?.replyMarkup,
      parseMode: interaction?.parseMode,
    });
    if (interaction?.id) {
      this.#interactions.set(interaction.id, {
        ...interaction,
        chatId,
        messageId: String(sent?.message_id ?? sent?.messageId ?? ''),
      });
    }
    return sent;
  }

  async #sendControlCard(chatId, command, details) {
    const card = controlCard(command, details, this.#t);
    return this.#sendCard(chatId, card.text, { parseMode: card.parseMode });
  }

  // 审批答复者：dsh 请求批准某工具调用时，发一张带「批准/拒绝」按钮的卡片，
  // 挂起直到 owner 点击（→ 'allowed-once' / 'rejected'）或请求被撤销（signal
  // abort / 插件关闭 → 'cancelled'）。无超时：按用户选择永久等待人工决定。
  // 返回的 ApprovalOutcome 由 dsh-user-approval service 消费。
  #handleApproval(chatId, req) {
    // 已中止的请求直接放弃，不打扰用户。
    if (req?.signal?.aborted === true) return Promise.resolve('cancelled');
    const id = randomUUID();
    const card = approvalCard(id, { toolName: req?.toolName, reason: req?.reason }, this.#t);
    return new Promise((resolve) => {
      let settled = false;
      const settle = (outcome) => {
        if (settled) return;
        settled = true;
        req?.signal?.removeEventListener?.('abort', onAbort);
        const record = this.#approvals.get(id);
        this.#approvals.delete(id);
        // 收尾时撤掉按钮，避免过期卡片仍可点击。
        if (record?.messageId) {
          void this.#transport
            .editCard(chatId, record.messageId, { inline_keyboard: [] })
            .catch((error) => console.error('[dsh-telegram] approval card cleanup failed:', error));
        }
        resolve(outcome);
      };
      const onAbort = () => settle('cancelled');
      this.#approvals.set(id, { chatId, messageId: '', settle });
      req?.signal?.addEventListener?.('abort', onAbort, { once: true });
      // 发送卡片并回填 messageId；发送失败则 fail-closed 到 unavailable。
      void this.#sendCard(chatId, card.text, { parseMode: card.parseMode, replyMarkup: card.replyMarkup })
        .then((sent) => {
          const record = this.#approvals.get(id);
          if (record) record.messageId = String(sent?.message_id ?? sent?.messageId ?? '');
        })
        .catch((error) => {
          console.error('[dsh-telegram] approval card send failed:', error);
          settle('unavailable');
        });
    });
  }

  async #handleInteraction(chatId, interaction) {
    if (!interaction?.id || !interaction?.kind) return;
    const card = interactionCard(interaction, this.#t);
    const question = interaction.payload?.questions?.[0] ?? interaction.payload;
    const values = question?.options?.map((option) => option.value ?? option.label ?? String(option));
    await this.#sendCard(chatId, card.text, {
      id: interaction.id,
      respond: interaction.respond,
      values,
      replyMarkup: card.replyMarkup,
    });
  }

  // Host 的远程 waterfall 会在根 context 派发，agent-scoped listener 无法跨过该边界。
  // global listener 先接收事件，再用 request.agent 精确识别 Telegram Session；其它
  // Session 继续交给 Web。
  #installRemoteInteractionBridges() {
    if (typeof this.#ctx.on !== 'function') return;
    const route = (request) => {
      const sessionId = request?.agent?.id;
      if (!sessionId) return null;
      for (const [chatId, handle] of this.#activeTurns) {
        if (String(handle.agent.id) === String(sessionId)) return chatId;
      }
      const ownerChatId = this.#config.ownerUserId;
      if (String(this.#bindings.get(ownerChatId)?.sessionId) === String(sessionId)) return ownerChatId;
      return null;
    };
    const runtime = this;
    const questionsDispose = this.#ctx.on(
      'user-questions/request',
      function (request, next) {
        const chatId = route(request);
        return chatId ? runtime.#handleUserQuestions(chatId, request) : next();
      },
      { global: true, prepend: true },
    );
    if (typeof questionsDispose === 'function') this.#remoteInteractionDisposers.push(questionsDispose);
    const approvalDispose = this.#ctx.on(
      'approval/request',
      function (request, next) {
        const chatId = route(request);
        return chatId ? runtime.#handleApproval(chatId, request) : next();
      },
      { global: true, prepend: true },
    );
    if (typeof approvalDispose === 'function') this.#remoteInteractionDisposers.push(approvalDispose);
  }

  async #handleUserQuestions(chatId, request) {
    const questions = Array.isArray(request?.questions) ? request.questions : [];
    if (questions.length === 0) throw new Error('user question request is empty');
    if (request.signal?.aborted) throw new Error('user question request was cancelled');
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        request.signal?.removeEventListener?.('abort', onAbort);
        callback();
      };
      const onAbort = () => finish(() => reject(new Error('user question request was cancelled')));
      request.signal?.addEventListener?.('abort', onAbort, { once: true });
      const respond = ({ value }) => {
        const first = questions[0];
        const labels = (first.options ?? []).map((option) => option.label ?? option.value ?? String(option));
        const selected = labels.includes(value) ? [value] : [];
        finish(() =>
          resolve({
            answers: questions.map((question, index) => ({
              id: question.id,
              selected: index === 0 ? selected : [],
              ...(index === 0 && selected.length === 0 ? { custom: value } : {}),
            })),
          }),
        );
      };
      const card = interactionCard({ id, kind: 'question', payload: request }, this.#t);
      void this.#sendCard(chatId, card.text, {
        id,
        respond,
        cancel: onAbort,
        values: (questions[0].options ?? []).map((option) => option.value ?? option.label ?? String(option)),
        replyMarkup: card.replyMarkup,
      })
        .then((sent) => {
          const messageId = sent?.message_id ?? sent?.messageId ?? '';
          console.info(`[dsh-telegram] user question card sent: chat=${chatId} message=${messageId}`);
        })
        .catch((error) => finish(() => reject(error)));
    });
  }

  async #resolveInteraction(interaction) {
    const id = String(interaction?.id ?? '');
    const current = this.#interactions.get(id);
    if (!current) return;
    this.#interactions.delete(id);
    await this.#transport.editCard(current.chatId, current.messageId, { inline_keyboard: [] });
  }
}

function capitalize(value) {
  return value[0].toUpperCase() + value.slice(1);
}

// 从绑定中取出完整的私聊级模型选择。两个字段必须同时存在才算有效选择，
// 半截记录（只有 provider 或只有 model）视为无选择，交由全局默认接管。
function boundSelection(binding) {
  if (!binding?.provider || !binding?.model) return undefined;
  return { provider: String(binding.provider), model: String(binding.model) };
}

// 解析控制命令。/model 是第一个接受参数的命令，因此返回值除 name 外还携带 args；
// 其余命令沿用「带参数即 unsupported」的既有行为。
function parseCommand(text) {
  const match = /^\/(new|status|stop|help|workspace|model)(?:@[^\s]+)?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) return text.trim().startsWith('/') ? { name: 'unsupported' } : null;
  const name = match[1].toLowerCase();
  const rest = match[2]?.trim() ?? '';
  if (name === 'model') {
    // 按空白切分。model id 不含空白，因此「恰好两段」即 provider + model，无歧义。
    return { name, args: rest ? rest.split(/\s+/) : [] };
  }
  if (name === 'workspace' && rest) return { name: 'unsupported' };
  return { name };
}

export function userFacingError(error, t = translate) {
  const message = String(error?.message ?? t('error.generic'));
  const status = Number(error?.code ?? error?.status ?? error?.response?.statusCode ?? 0);
  if (status === 429 || /rate|flood|too many requests|429/i.test(message)) {
    return t('error.rateLimited');
  }
  if (
    /Telegram (?:media|image)|attachment service|could not be downloaded|exceeds the supported size limit|Unsupported Telegram media|无法交付/i.test(
      message,
    )
  ) {
    return t('error.media');
  }
  if (/message is not modified|message to edit not found|can't be edited|edit/i.test(message)) {
    return t('error.editFallback');
  }
  if (/interaction|expired|已失效|no longer/i.test(message)) {
    return t('error.interactionExpired');
  }
  if (status >= 400 || /bad request|forbidden|unauthorized|telegram api/i.test(message)) {
    return t('error.service');
  }
  return t('error.fallback');
}
