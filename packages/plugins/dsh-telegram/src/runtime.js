import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { normalizeConfig, resolveCredentials } from './config.js';
import { normalizeInboundMessage, splitMessageText } from './message.js';
import { SessionStore } from './session-store.js';
import { createTelegramClient, createTelegramTransport } from './telegram-client.js';
import { StreamSession } from './stream.js';
import { classifyContent, controlCard, interactionCard, statusCard } from './outbound.js';

export class TelegramRuntime {
  #ctx;
  #config;
  #credentials;
  #workspaceRegistry;
  #state;
  #connection;
  #transport;
  #bindings;
  #sessionHandles = new Map();
  #inflight = new Map();
  #activeTurns = new Map();
  #cancelledChats = new Set();
  #stopping = new Set();
  #interactions = new Map();
  #streams = new Map();
  #reactions = new Map();
  #stopped = false;

  constructor(ctx, config, { createClient = createTelegramClient, statePath } = {}) {
    this.#ctx = ctx;
    this.#config = normalizeConfig(config);
    this.#credentials = ctx.credentials;
    this.#workspaceRegistry = ctx.workspaceRegistry;
    // 会话绑定持久化到 $DSH_HOME（profile 家目录，默认 ~/.dsh），与 dsh 自身的
    // $DSH_HOME/cordis.patch.yml 存放惯例一致；绝不写入 process.cwd()，否则 dsh
    // 在项目目录启动时会把状态文件落进 git 工作区。
    this.#state = statePath ?? defaultStatePath();
    this.#createClient = createClient;
  }

  #createClient;

  async start() {
    const workspace = this.#workspaceRegistry?.get(this.#config.workspaceId);
    if (!workspace) throw new Error('Telegram workspaceId does not resolve to a registered Workspace');
    if ((await workspace.status()) !== 'ok') throw new Error('Telegram Workspace directory is unavailable');
    const credentials = await resolveCredentials(this.#credentials);
    this.#bindings = await new SessionStore(this.#state).load();
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
    for (const stream of this.#streams.values()) await stream.dispose?.();
    this.#streams.clear();
    await this.#connection?.close?.();
    this.#connection = null;
    this.#transport = null;
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
        interactionPending: Boolean(this.#pendingInteraction(chatId)),
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
    const binding = this.#bindings.get(chatId);
    if (!binding) {
      await this.#sendControlCard(chatId, command.name, { message: '当前没有活动会话。' });
      return;
    }
    const handle = await this.#sessionFor(chatId);
    if (command.name === 'stop') {
      handle.agent.cancel({ kind: 'user' });
      await this.#sendControlCard(chatId, 'stop', { message: '已请求停止当前任务。' });
    }
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
        return handle;
      }
      let resumed;
      try {
        resumed = await this.#ctx.agents.resume({
          resumeSessionId: current.sessionId,
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
        return resumed;
      }
    }
    const handle = await this.#createSession(chatId);
    await this.#bindings.set(chatId, { sessionId: handle.agent.id, workspaceId: this.#config.workspaceId });
    return handle;
  }

  // 构造 agent 的 setup 回调，create 与 resume 共用。
  // 关键职责：注入 model selection、交互桥、session 事件流，并挂载默认 preset。
  // 缺少 preset.mount 时 agent 作用域没有任何工具 → 请求 tools=[] → DeepSeek 适配器
  // 不发 tools → 模型把工具调用裸写成 <｜｜DSML｜｜...> 文本泄漏进正文。
  // 参考 web 入口 dsh-host-apiproxy 的 composeAgent。
  // selection 由调用方传入以复用同一份快照（create 侧 agentOptions 与 setup 必须一致）；
  // 未传时（resume 侧）自取一次。
  #buildAgentSetup(chatId, selection = this.#ctx.agentDefaultModel?.currentSelection?.()) {
    const presets = this.#ctx.get?.('agentPresets') ?? this.#ctx.agentPresets;
    return async (agentCtx) => {
      if (selection) installModelSelection(agentCtx, { current: selection, assembled: undefined });
      installInteractionBridge(agentCtx, {
        onRequested: (interaction) => this.#handleInteraction(chatId, interaction),
        onResolved: (interaction) => this.#resolveInteraction(interaction),
      });
      installSessionStream(agentCtx, (event) => this.#onSessionEvent(chatId, event));
      // 放在最后：mount 失败会回滚整个 agent 创建，前面的注册也随之撤销。
      if (presets?.mount) await presets.mount(agentCtx, undefined);
    };
  }

  async #createSession(chatId) {
    const workspace = this.#workspaceRegistry.get(this.#config.workspaceId);
    const selection = this.#ctx.agentDefaultModel?.currentSelection?.();
    const handle = await this.#ctx.agents.create({
      sessionId: `telegram-${randomUUID()}`,
      meta: { cwd: workspace.path },
      ...(selection ? { agentOptions: { provider: selection.provider, model: selection.model } } : {}),
      setup: this.#buildAgentSetup(chatId, selection),
    });
    await workspace.attachSession(handle.agent.id);
    this.#sessionHandles.set(handle.agent.id, handle);
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

// 复刻 @deepseek-ai/dsh-agent 官方 installModelSelection 的快照语义（该包只存在于
// dsh 运行时、无法作为插件依赖安装，故在此内联）。核心：system-prompt/assemble 阶段
// 把 selection.current 快照进 selection.assembled，agent/request 阶段读同一份快照，
// 确保「组装 prompt 的 provider/model」与「实际发请求的 provider/model」严格一致；
// 二者若漂移，DeepSeek 适配器会走非结构化路径、把工具调用裸写成 DSML 文本。
function installModelSelection(agentCtx, selection) {
  agentCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const selected = selection.current;
    const assembled = await next();
    selection.assembled = selected;
    if (selected === undefined) return assembled;
    return {
      ...assembled,
      variables: {
        ...assembled.variables,
        provider: selected.provider,
        model: selected.model,
      },
    };
  });
  agentCtx.on('agent/request', async (_payload, next) => {
    const resolved = await next();
    const selected = selection.assembled;
    if (selected === undefined) return resolved;
    // 剥离 resolved 继承来的 reasoningEffort：仅当所选 selection 显式带 effort 时才回填，
    // 否则清空以恢复所选模型的 provider/默认行为（与官方实现一致）。
    const { reasoningEffort: _inheritedEffort, ...withoutInheritedEffort } = resolved;
    return {
      ...withoutInheritedEffort,
      provider: selected.provider,
      model: selected.model,
      ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
    };
  });
}

function installInteractionBridge(agentCtx, { onRequested, onResolved }) {
  if (typeof agentCtx?.on !== 'function') return;
  agentCtx.on('interaction/requested', onRequested);
  agentCtx.on('interaction/resolved', onResolved);
}

// 订阅 session 增量事件流（@deepseek-ai/dsh-session `session/event`）。
// 每次 session log 增长即回调，用于驱动 Telegram 实时流式输出。
function installSessionStream(agentCtx, onEvent) {
  if (typeof agentCtx?.on !== 'function') return;
  agentCtx.on('session/event', (_session, event) => onEvent(event));
}

async function stopAgentTurn(agent) {
  // Harness agent 的真实停止 API 是同步的 cancel(cause, options)，返回 void。
  // 参考 @deepseek-ai/dsh-agent runtime-types.d.ts:
  //   cancel(cause: AgentCancelCause, options?: CancelOptions): void
  //   status: AgentStatus = 'idle' | 'running'
  //   文档明确："若无活动 activity，cancellation 是 no-op"。
  // 因此 stop 前必须检查 status：idle 时不能谎报"已停止"。
  if (typeof agent?.cancel !== 'function') return false;
  if (agent.status !== 'running') return false;
  agent.cancel({ kind: 'user' }, { keepInbox: true });
  return true;
}

function capitalize(value) {
  return value[0].toUpperCase() + value.slice(1);
}

// 会话绑定文件的默认位置：$DSH_HOME/telegram-sessions.json（DSH_HOME 未设时回退
// 到 ~/.dsh）。刻意不用 process.cwd()——dsh 通常在项目目录启动，落到 cwd 会污染
// git 工作区。
export function defaultStatePath() {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(dshHome, 'telegram-sessions.json');
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
