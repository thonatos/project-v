import { randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { basename, isAbsolute, resolve as resolvePath, sep } from 'node:path';
import { normalizeConfig, resolveCredentials } from './config.js';
import { normalizeInboundMessage, splitMessageText } from './transport/inbound.js';
import { openBindingStore } from './persist.js';
import { createTelegramClient } from './transport/client.js';
import { createTelegramTransport, TELEGRAM_MEDIA_LIMIT } from './transport/transport.js';
import { StreamSession } from './render/stream.js';
import { approvalCard, classifyContent, controlCard, interactionCard, statusCard } from './render/cards.js';
import { extractLocalImagePaths } from './render/local-images.js';
import { buildAgentSetup, installAgentBridges, stopAgentTurn } from './agent/integration.js';

export class TelegramRuntime {
  #ctx;
  #config;
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
  #stopped = false;

  constructor(ctx, config, { createClient = createTelegramClient, openStore = openBindingStore } = {}) {
    this.#ctx = ctx;
    this.#config = normalizeConfig(config);
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
      proxy: this.#config.proxy,
      onMessage: (event) => this.#handleMessage(event),
      onCallbackQuery: (event) => this.#handleCallbackQuery(event),
    });
    this.#transport = createTelegramTransport(this.#connection);
    this.#ctx.effect?.(() => () => this.stop());
    return this;
  }

  async stop() {
    if (this.#stopped) return;
    this.#stopped = true;
    for (const handle of this.#sessionHandles.values()) await handle.dispose?.();
    this.#sessionHandles.clear();
    this.#inflight.clear();
    this.#activeTurns.clear();
    this.#cancelledChats.clear();
    this.#stopping.clear();
    this.#interactions.clear();
    // 关闭时把所有待决审批 settle 成 cancelled，让挂起的 answerer 立即返回，
    // 不残留永久 pending 的 Promise。
    for (const approval of this.#approvals.values()) approval.settle?.('cancelled');
    this.#approvals.clear();
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
      await this.#transport.answerCallback(callback.id, '该操作无效。');
      return;
    }
    if (prefix !== 'dsh' || !kind || !interactionId || !value) {
      await this.#transport.answerCallback(callback.id, '该操作无效。');
      return;
    }
    // 审批点击：settle 对应的挂起 answerer。approval 走 #approvals，与 interaction 分离。
    if (kind === 'approval') {
      const approval = this.#approvals.get(interactionId);
      if (!approval || approval.chatId !== String(callback.chatId)) {
        await this.#transport.answerCallback(callback.id, '该审批已失效或已被处理。');
        return;
      }
      const outcome = value === 'approve' ? 'allowed-once' : 'rejected';
      approval.settle(outcome);
      await this.#transport.answerCallback(callback.id, value === 'approve' ? '已批准' : '已拒绝');
      return;
    }
    const interaction = this.#interactions.get(interactionId);
    if (!interaction || interaction.chatId !== String(callback.chatId)) {
      await this.#transport.answerCallback(callback.id, '该交互已失效或已被处理。');
      return;
    }
    try {
      await this.#respondToInteraction(interaction, { kind, value });
      await this.#transport.answerCallback(callback.id, '已提交');
    } catch (error) {
      console.error('[dsh-telegram] interaction response failed:', error);
      await this.#transport.answerCallback(callback.id, '提交失败，请稍后重试。');
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
      this.#activeTurns.set(chatId, handle);
      // 为本次 turn 建立流式会话：session/event 增量事件由 #onSessionEvent 路由到它。
      const stream = new StreamSession({
        transport: this.#transport,
        chatId,
        limit: this.#config.messageLimit,
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
      // 流式已交付正文与工具卡片；此处仅补发非文本媒体产物（图片等）。
      await this.#sendMediaArtifacts(chatId, handle.agent.session);
    } catch (error) {
      console.error('[dsh-telegram] message processing failed:', error);
      await this.#sendText(chatId, userFacingError(error));
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
      await this.#sendControlCard(chatId, 'stop', { message: '当前没有正在运行的任务。' });
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
      await this.#sendControlCard(chatId, 'stop', { message: '当前没有正在运行的任务。' });
      return;
    }
    await this.#sendControlCard(chatId, 'stop', { message: '已请求停止当前任务。' });
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
        message: '该命令不可用。',
        detail: '可用命令：/new、/status、/stop、/help',
      });
      return;
    }
    if (command.name === 'help') {
      await this.#sendControlCard(chatId, 'help', {
        message: '可用命令：',
        detail: '/new\n/status\n/stop\n/help',
      });
      return;
    }
    if (command.name === 'status') {
      const handle = await this.#sessionFor(chatId);
      const card = statusCard({
        workspaceId: this.#config.workspaceId,
        sessionId: handle.agent.id,
        active: this.#activeTurns.has(chatId),
        interactionPending: Boolean(this.#pendingInteraction(chatId)) || this.#hasPendingApproval(chatId),
      });
      await this.#sendCard(chatId, card.text, { parseMode: card.parseMode });
      return;
    }
    if (command.name === 'new') {
      const previous = this.#bindings.get(chatId);
      const handle = await this.#createSession(chatId);
      if (previous) await this.#sessionHandles.get(previous.sessionId)?.dispose?.();
      await this.#bindings.set(chatId, { sessionId: handle.agent.id, workspaceId: this.#config.workspaceId });
      await this.#sendControlCard(chatId, 'new', { message: '新会话已建立。' });
      return;
    }
    // parseCommand 只产出 new/status/help/unsupported（均已 return）与 stop
    // （在 #handleMessage 的 fast-path 拦截），不会走到这里。
  }

  async #sessionFor(chatId) {
    const binding = this.#bindings.get(chatId);
    if (binding?.workspaceId !== this.#config.workspaceId) await this.#bindings.delete(chatId);
    const current = this.#bindings.get(chatId);
    if (current) {
      const existing = this.#sessionHandles.get(current.sessionId);
      if (existing) return existing;
      const live = this.#ctx.agents.get?.(current.sessionId);
      if (live) {
        const handle = { agent: live, async dispose() {} };
        this.#sessionHandles.set(current.sessionId, handle);
        // 复用注册表里的裸 agent：setup 不会再跑，必须在其 agent-scoped ctx 上补装桥接，
        // 否则 session/event 不路由到 StreamSession（正文丢失）、审批/交互也收不到。
        this.#ensureBridges(chatId, live);
        return handle;
      }
      let resumed;
      try {
        // resume 侧与 create 侧一致地传入 agentOptions（provider/model 快照）：
        // 这是 dsh 官方防止 provider/model 漂移的机制，取代了曾经的 installModelSelection 内联复刻。
        const selection = this.#ctx.agentDefaultModel?.currentSelection?.();
        resumed = await this.#ctx.agents.resume({
          resumeSessionId: current.sessionId,
          ...(selection ? { agentOptions: { provider: selection.provider, model: selection.model } } : {}),
          setup: this.#buildAgentSetup(chatId),
        });
      } catch {
        await this.#bindings.delete(chatId);
        resumed = undefined;
      }
      if (!resumed) {
        const handle = await this.#createSession(chatId);
        await this.#bindings.set(chatId, { sessionId: handle.agent.id, workspaceId: this.#config.workspaceId });
        return handle;
      }
      if (
        String(resumed.agent.session.header.cwd) !== String(this.#workspaceRegistry.get(this.#config.workspaceId).path)
      ) {
        await resumed.dispose();
        await this.#bindings.delete(chatId);
      } else {
        this.#sessionHandles.set(current.sessionId, resumed);
        // resume 的 setup 已装好桥接：登记以防其后走「复用 live agent」路径时重复注册。
        this.#bridged.add(resumed.agent.id);
        return resumed;
      }
    }
    const handle = await this.#createSession(chatId);
    await this.#bindings.set(chatId, { sessionId: handle.agent.id, workspaceId: this.#config.workspaceId });
    return handle;
  }

  // 本插件依赖的 agent-scoped 桥接参数（交互/审批/session 事件流）。
  // create/resume 的 setup 与「复用已存活 agent」两条路径共用同一组回调。
  #bridgeArgs(chatId) {
    return {
      onInteractionRequested: (interaction) => this.#handleInteraction(chatId, interaction),
      onInteractionResolved: (interaction) => this.#resolveInteraction(interaction),
      onApprovalRequested: (req) => this.#handleApproval(chatId, req),
      onSessionEvent: (event) => this.#onSessionEvent(chatId, event),
    };
  }

  // 在已存活 agent 的 agent-scoped ctx 上补装桥接（仅首次；用 #bridged 去重）。
  #ensureBridges(chatId, agent) {
    const id = agent?.id ?? '';
    if (!id || this.#bridged.has(id)) return;
    const agentCtx = agent?.ctx;
    if (typeof agentCtx?.on !== 'function') return;
    installAgentBridges(agentCtx, this.#bridgeArgs(chatId));
    this.#bridged.add(id);
  }

  // 构造 agent 的 setup 回调，create 与 resume 共用。具体注入逻辑见 agent/integration.js。
  // provider/model 一致性由 create/resume 两侧的 agentOptions 保证，setup 不再管 selection。
  // preset 通过官方 ctx.agentPresets.mount 挂载。
  #buildAgentSetup(chatId) {
    const presets = this.#ctx.agentPresets;
    return buildAgentSetup({
      mountPreset: presets?.mount ? (agentCtx) => presets.mount(agentCtx, undefined) : undefined,
      ...this.#bridgeArgs(chatId),
    });
  }

  async #createSession(chatId) {
    const workspace = this.#workspaceRegistry.get(this.#config.workspaceId);
    const selection = this.#ctx.agentDefaultModel?.currentSelection?.();
    const handle = await this.#ctx.agents.create({
      sessionId: `telegram-${randomUUID()}`,
      meta: { cwd: workspace.path },
      ...(selection ? { agentOptions: { provider: selection.provider, model: selection.model } } : {}),
      setup: this.#buildAgentSetup(chatId),
    });
    await workspace.attachSession(handle.agent.id);
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

  // 流式已交付文本与工具状态；这里只补发 Harness 登记的媒体产物（图片等）。
  async #sendMediaArtifacts(chatId, session) {
    const messages = session?.deriveMessages?.() ?? [];
    const assistant = [...messages].reverse().find((message) => message?.role === 'assistant');
    if (!assistant) return;
    const events = classifyContent(assistant.content ?? []);
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
        await this.#sendText(chatId, `无法交付 ${kind} 类型媒体。`);
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
        await this.#sendText(chatId, `无法交付 ${kind} 类型媒体：${userFacingError(error)}`);
      }
    }
    // 补发正文里以 markdown `![](本地路径)` 内联的图片（agent 未登记为 attachment
    // 时的降级路径）。仅限当前 workspace 目录内、扩展名为图片的文件，且经 realpath
    // 校验防目录穿越。
    await this.#sendLocalImages(chatId, caption);
  }

  // 扫描正文里的本地图片路径，安全校验后读取并作为独立图片发送。
  async #sendLocalImages(chatId, text) {
    const paths = extractLocalImagePaths(text);
    if (paths.length === 0) return;
    const workspace = this.#workspaceRegistry.get(this.#config.workspaceId);
    if (!workspace?.path) return;
    let root;
    try {
      root = await realpath(workspace.path);
    } catch {
      return;
    }
    // 已发送的真实路径集合，按 realpath 去重（见循环内说明）。
    const sent = new Set();
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
          await this.#sendText(chatId, `图片过大，无法发送：${basename(real)}`);
          continue;
        }
        await this.#transport.sendMedia(chatId, bytes, { kind: 'image', fileName: basename(real) });
      } catch (error) {
        console.error('[dsh-telegram] local image delivery failed:', error);
        await this.#sendText(chatId, `无法发送图片：${userFacingError(error)}`);
      }
    }
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
    const card = controlCard(command, details);
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
    const card = approvalCard(id, { toolName: req?.toolName, reason: req?.reason });
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
    const card = interactionCard(interaction);
    await this.#sendCard(chatId, card.text, {
      id: interaction.id,
      respond: interaction.respond,
      replyMarkup: card.replyMarkup,
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

function parseCommand(text) {
  const match = /^\/(new|status|stop|help)(?:@[^\s]+)?(?:\s+.*)?$/i.exec(text.trim());
  return match ? { name: match[1].toLowerCase() } : text.trim().startsWith('/') ? { name: 'unsupported' } : null;
}

export function userFacingError(error) {
  const message = String(error?.message ?? 'Telegram 消息处理失败');
  const status = Number(error?.code ?? error?.status ?? error?.response?.statusCode ?? 0);
  if (status === 429 || /rate|flood|too many requests|429/i.test(message)) {
    return 'Telegram 请求过于频繁，请稍后重试。';
  }
  if (
    /Telegram (?:media|image)|attachment service|could not be downloaded|exceeds the supported size limit|Unsupported Telegram media|无法交付/i.test(
      message,
    )
  ) {
    return '媒体处理失败，请确认文件格式和大小后重试。';
  }
  if (/message is not modified|message to edit not found|can't be edited|edit/i.test(message)) {
    return '消息更新失败，已改为发送新消息。';
  }
  if (/interaction|expired|已失效|no longer/i.test(message)) {
    return '该交互已失效或已被处理。';
  }
  if (status >= 400 || /bad request|forbidden|unauthorized|telegram api/i.test(message)) {
    return 'Telegram 服务返回错误，请稍后重试。';
  }
  return '消息处理失败，请稍后重试。';
}
