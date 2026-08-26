export function installInteractionBridge(agentCtx, { onRequested, onResolved }) {
  if (typeof agentCtx?.on !== 'function') return;
  agentCtx.on('interaction/requested', onRequested);
  agentCtx.on('interaction/resolved', onResolved);
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
  { onInteractionRequested, onInteractionResolved, onApprovalRequested, onSessionEvent },
) {
  installInteractionBridge(agentCtx, {
    onRequested: onInteractionRequested,
    onResolved: onInteractionResolved,
  });
  installApprovalBridge(agentCtx, onApprovalRequested);
  installSessionStream(agentCtx, onSessionEvent);
}

// 不再需要 installModelSelection 的双 waterfall 内联复刻（快照一致性交给 agentOptions）。
export function buildAgentSetup({
  mountPreset,
  onInteractionRequested,
  onInteractionResolved,
  onApprovalRequested,
  onSessionEvent,
}) {
  return async (agentCtx) => {
    installAgentBridges(agentCtx, {
      onInteractionRequested,
      onInteractionResolved,
      onApprovalRequested,
      onSessionEvent,
    });
    // 放在最后：mount 失败会回滚整个 agent 创建，前面的注册也随之撤销。
    if (mountPreset) await mountPreset(agentCtx);
  };
}
