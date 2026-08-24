import { Config, SETTINGS_NAMESPACE } from './config.js';
import { TelegramRuntime } from './runtime.js';

export const name = 'dsh-telegram';
export const inject = ['settings', 'credentials', 'agents', 'agentDefaultModel', 'workspaceRegistry', 'attachments'];

export { Config };
export { SETTINGS_NAMESPACE };
export { TelegramRuntime };

export function apply(ctx, config = {}) {
  const settings = ctx.settings.register(SETTINGS_NAMESPACE, Config, {
    base: config,
    applies: 'restart',
    label: 'Telegram',
    description: 'Telegram Bot API 私聊机器人',
  });
  let runtime;
  const start = async (value) => {
    await runtime?.stop();
    runtime = value.enabled ? await new TelegramRuntime(ctx, value).start() : undefined;
  };
  void start(settings.get()).catch((error) => console.error('[dsh-telegram] failed to start:', error));
  settings.watch((next) => start(next).catch((error) => console.error('[dsh-telegram] failed to restart:', error)));
  ctx.effect(() => () => runtime?.stop());
}
