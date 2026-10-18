import { BOT_TOKEN_REF, Config, SETTINGS_NAMESPACE } from './config.js';
import { TelegramRuntime } from './runtime.js';
import { RuntimeCoordinator } from './runtime-coordinator.js';

export const name = 'dsh-telegram';
export const inject = [
  'settings',
  'credentials',
  'agents',
  'agentDefaultModel',
  'agentPresets',
  'sessionQuery',
  'llm',
  'workspaceRegistry',
  'attachments',
  'storageDomain',
];

export { Config };
export { SETTINGS_NAMESPACE };
export { TelegramRuntime };
export { RuntimeCoordinator };

export function install(ctx, config = {}, { createRuntime = (value) => new TelegramRuntime(ctx, value) } = {}) {
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber));

  const coordinator = new RuntimeCoordinator({
    config: () => config,
    createRuntime,
    logger: ctx.logger ?? console,
  });

  ctx.on('loader/volatile-update', () => coordinator.reconcile());
  ctx.on('credentials/reference-updated', (ref) => {
    if (String(ref) === BOT_TOKEN_REF) void coordinator.reconcile();
  });
  void coordinator.reconcile();
  ctx.effect(() => () => coordinator.dispose());
  return coordinator;
}

export function apply(ctx, config = {}) {
  install(ctx, config);
}
