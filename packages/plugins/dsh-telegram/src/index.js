import { Config, SETTINGS_NAMESPACE } from './config.js';
import { createTranslator } from './i18n/index.js';
import { TelegramRuntime } from './runtime.js';

export const name = 'dsh-telegram';
export const inject = [
  'settings',
  'credentials',
  'agents',
  'agentDefaultModel',
  'agentPresets',
  'llm',
  'workspaceRegistry',
  'attachments',
  'storageDomain',
];

export { Config };
export { SETTINGS_NAMESPACE };
export { TelegramRuntime };

export function apply(ctx, config = {}) {
  // 设置项描述随 language 变化；这里只做归一化，不校验（workspaceId 等由运行时校验）。
  const t = createTranslator(config?.language);
  const settings = ctx.settings.register(SETTINGS_NAMESPACE, Config, {
    base: config,
    applies: 'restart',
    label: 'Telegram',
    description: t('settings.description'),
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
