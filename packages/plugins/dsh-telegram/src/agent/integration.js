export function installInteractionBridge(agentCtx, { onRequested, onResolved }) {
  if (typeof agentCtx?.on !== 'function') return;
  agentCtx.on('interaction/requested', onRequested);
  agentCtx.on('interaction/resolved', onResolved);
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
// 不再需要 installModelSelection 的双 waterfall 内联复刻（快照一致性交给 agentOptions）。
export function buildAgentSetup({ mountPreset, onInteractionRequested, onInteractionResolved, onSessionEvent }) {
  return async (agentCtx) => {
    installInteractionBridge(agentCtx, {
      onRequested: onInteractionRequested,
      onResolved: onInteractionResolved,
    });
    installSessionStream(agentCtx, onSessionEvent);
    // 放在最后：mount 失败会回滚整个 agent 创建，前面的注册也随之撤销。
    if (mountPreset) await mountPreset(agentCtx);
  };
}
