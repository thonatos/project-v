import { installModelSelection } from '@deepseek-ai/dsh-agent';

export function installInteractionBridge(agentCtx, { onRequested, onResolved }) {
  if (typeof agentCtx?.on !== 'function') return;
  agentCtx.on('interaction/requested', onRequested);
  agentCtx.on('interaction/resolved', onResolved);
}

// ask_user_question 使用独立的 user-questions/request waterfall，不会经过
// interaction/requested。注册在 agent scope 并 prepend，确保 Telegram 先于 Web 的
// 全局答复者处理当前 agent 的问题，同时由 Cordis context filter 隔离其它 agent。
export function installUserQuestionsBridge(agentCtx, onRequested) {
  if (typeof agentCtx?.on !== 'function' || typeof onRequested !== 'function') return;
  agentCtx.on('user-questions/request', onRequested, { prepend: true });
}

// 注册审批答复者（dsh-user-approval `approval/request` waterfall，agent-scoped）。
// 这是 dsh 把「操作需要人工批准」送达外部 UI 的真实机制：service 在 policy='ask'
// 且无答复者时 fail-closed，因此必须显式注册；返回一个 ApprovalOutcome 认领该请求，
// 或调用 next() 交给链上其它答复者。agentCtx 是本 agent 的 scope，只会收到该 agent
// 自己的审批请求，不影响 web UI 或其它 agent。
//
// prepend: true 至关重要。dsh-host-apiproxy 在插件加载时注册了一个「全局无 scope」的
// approval/request 答复者（会匹配任意 agent），它先于本 agent-scoped 答复者入队；
// waterfall 按注册顺序执行，且不调用 next() 即否决后续答复者。若不 prepend，web 的
// 全局答复者会抢先认领本 Telegram agent 的审批（表现为「web 有记录，telegram 收不到」）。
// prepend 让本答复者排到队首、先于 web 全局答复者执行；因仍是 agent-scoped，只影响本
// agent 自己的请求，不会波及 web agent。
// 参考：dsh-host-apiproxy 的 `ctx.on('approval/request', (req, next) => ...)`。
export function installApprovalBridge(agentCtx, onApprovalRequested) {
  if (typeof agentCtx?.on !== 'function' || typeof onApprovalRequested !== 'function') return;
  agentCtx.on('approval/request', (req) => onApprovalRequested(req), { prepend: true });
}

// 订阅 session 增量事件流（@deepseek-ai/dsh-session `session/event`）。
// 每次 session log 增长即回调，用于驱动 Telegram 实时流式输出。
export function installSessionStream(agentCtx, onEvent) {
  if (typeof agentCtx?.on !== 'function') return;
  agentCtx.on('session/event', (_session, event) => onEvent(event));
}

// 安装 agent 级可变模型选择（@deepseek-ai/dsh-agent `installModelSelection`）。
//
// 这是「/model 切换后当前会话立刻生效」的唯一机制：官方在 prompt assembly 前快照
// ref.current，因此并发切换落在后续 step 而非撕裂正在进行的请求；provider/model 变化时
// 官方还会向下次请求追加一条 durable user-role 通知，让模型自己知道换过。
//
// 历史说明：本插件曾内联复刻过一份 installModelSelection，2026-08-25 的重构将其删除并
// 改用 agentOptions —— 删掉的是「手写复刻」（复刻会与官方实现漂移，该结论至今仍然成立
// 且被遵守），而非「这个机制本身」。当时也没有热切换需求，创建时的快照足够。
// 现在需求变了，因此引入官方导出的正品：只导入这一个符号，把耦合面压到最小。
//
// agentOptions 与本 ref 的分工：前者是创建时的初始快照，后者是后续 step 的可变来源。
// 两者必须由同一个 selection 值喂入，否则会出现「首轮用 A、次轮莫名换 B」。
export function installAgentModelSelection(agentCtx, selection) {
  if (typeof agentCtx?.on !== 'function') return undefined;
  const ref = { current: selection ? { ...selection } : undefined, assembled: undefined };
  installModelSelection(agentCtx, ref);
  return ref;
}

export async function stopAgentTurn(agent) {
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

// 组装 agent 的 setup 回调，create 与 resume 共用。
// 关键职责：注入交互桥、session 事件流，并挂载默认 preset。
// 缺少 preset.mount 时 agent 作用域没有任何工具 → 请求 tools=[] → DeepSeek 适配器
// 不发 tools → 模型把工具调用裸写成 <｜｜DSML｜｜...> 文本泄漏进正文。
// 参考 web 入口 dsh-host-apiproxy 的 composeAgent。
//
// provider/model 一致性由 create/resume 两侧统一传入的 agentOptions 保证（官方机制），
// 安装本插件依赖的三个 agent-scoped 桥接（交互、审批、session 事件流），不含 preset 挂载。
// create/resume 的 setup 与「复用已存活 agent」两条路径共用：后者拿到的是注册表里的
// 裸 Agent（ctx.agents.get），setup 不会再跑，必须显式在 live.ctx 上补装这些桥接，
// 否则 session/event 不会路由到 StreamSession（正文整段丢失）、审批也收不到。
export function installAgentBridges(
  agentCtx,
  { onInteractionRequested, onInteractionResolved, onUserQuestionsRequested, onApprovalRequested, onSessionEvent },
) {
  installInteractionBridge(agentCtx, {
    onRequested: onInteractionRequested,
    onResolved: onInteractionResolved,
  });
  installUserQuestionsBridge(agentCtx, onUserQuestionsRequested);
  installApprovalBridge(agentCtx, onApprovalRequested);
  installSessionStream(agentCtx, onSessionEvent);
}

// 组装 agent 的 setup 回调，create 与 resume 共用。
// 关键职责：注入交互桥、session 事件流、agent 级模型选择，并挂载默认 preset。
// 缺少 preset.mount 时 agent 作用域没有任何工具 → 请求 tools=[] → DeepSeek 适配器
// 不发 tools → 模型把工具调用裸写成 <｜｜DSML｜｜...> 文本泄漏进正文。
// 参考 web 入口 dsh-host-apiproxy 的 composeAgent。
//
// 创建时的 provider/model 快照由 create/resume 两侧统一传入的 agentOptions 保证（官方机制）；
// 后续 step 的可变来源由 installSelection 安装的 ModelSelectionRef 提供，两者同源。
// create/resume 的 setup 与「复用已存活 agent」两条路径共用：后者拿到的是注册表里的
// 裸 Agent（ctx.agents.get），setup 不会再跑，必须显式在 live.ctx 上补装这些桥接与选择，
// 否则 session/event 不会路由到 StreamSession（正文整段丢失）、审批收不到、/model 也无效。
export function buildAgentSetup({
  mountPreset,
  installSelection,
  onInteractionRequested,
  onInteractionResolved,
  onUserQuestionsRequested,
  onApprovalRequested,
  onSessionEvent,
}) {
  return async (agentCtx, agent) => {
    // preset 可能注册自己的 prepend 审批答复者（例如 Web UI）。先完成 mount，再注册
    // Telegram 的 prepend bridge，确保它位于该 agent 的 waterfall 最外层。
    if (mountPreset) await mountPreset(agentCtx);
    installAgentBridges(agentCtx, {
      onInteractionRequested,
      onInteractionResolved,
      onUserQuestionsRequested,
      onApprovalRequested,
      onSessionEvent,
    });
    installSelection?.(agentCtx, agent);
  };
}
