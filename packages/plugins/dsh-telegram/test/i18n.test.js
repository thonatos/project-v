import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { DEFAULT_LOCALE, LOCALES, createTranslator, normalizeLocale } from '../src/i18n/index.js';
import { MESSAGES } from '../src/i18n/messages.js';
import {
  approvalCard,
  controlCard,
  interactionCard,
  modelListChunks,
  statusCard,
  toolCard,
  toolCardText,
  workspaceCard,
} from '../src/render/cards.js';
import { StreamSession } from '../src/render/stream.js';
import { TELEGRAM_COMMANDS, buildTelegramCommands } from '../src/transport/client.js';
import { userFacingError } from '../src/runtime.js';

// 中文字符范围：翻译生效后西文/俄文文案里不应再出现汉字。
const CJK = /[\u4e00-\u9fff]/;
const CYRILLIC = /[\u0400-\u04ff]/;

const placeholders = (template) => [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('ships every locale with the same keys and placeholders as the base language', () => {
  const baseKeys = Object.keys(MESSAGES[DEFAULT_LOCALE]).sort();
  assert.deepEqual(LOCALES, ['zh', 'en', 'ru']);
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(MESSAGES[locale]).sort(), baseKeys, `${locale} 的 key 集合必须与 zh 一致`);
    for (const key of baseKeys) {
      assert.deepEqual(
        placeholders(MESSAGES[locale][key]),
        placeholders(MESSAGES[DEFAULT_LOCALE][key]),
        `${locale}.${key} 的占位符必须与 zh 一致`,
      );
    }
  }
});

test('normalizes locale ids and falls back to the default language', () => {
  assert.equal(normalizeLocale('ru-RU'), 'ru');
  assert.equal(normalizeLocale('EN'), 'en');
  assert.equal(normalizeLocale('zh-CN'), 'zh');
  assert.equal(normalizeLocale(' de '), DEFAULT_LOCALE);
  assert.equal(normalizeLocale(''), DEFAULT_LOCALE);
  assert.equal(normalizeLocale(undefined), DEFAULT_LOCALE);
});

test('translator substitutes known placeholders and keeps unknown ones visible', () => {
  const t = createTranslator('en');
  assert.equal(t('common.field', { label: 'Tool', value: 'bash' }), 'Tool: bash');
  // 未知参数原样保留：模板与调用点不一致时消息里能直接看出来。
  assert.equal(t('common.field', { label: 'Tool' }), 'Tool: {value}');
  // 未登记的 key 原样返回，而不是静默变空。
  assert.equal(t('missing.key'), 'missing.key');
  // 未登记的语言回落到基准语言（zh）。
  assert.equal(createTranslator('de')('tool.card.title'), MESSAGES.zh['tool.card.title']);
});

test('keeps the pre-localization copy as the default language', () => {
  assert.equal(MESSAGES.zh['tool.card.title'], '🔧 任务执行中');
  assert.equal(MESSAGES.zh['status.card.title'], '📱 Telegram 状态');
  assert.equal(MESSAGES.zh['approval.button.approve'], '批准');
  // 不传 translator 时行为与本地化之前一致（既有调用点与测试不受影响）。
  const card = toolCard('bash', 'running', undefined, { completed: 1, active: 2 });
  assert.match(card, /执行中/);
  assert.match(card, /1 个工具调用已完成 · 2 个执行中/);
});

test('renders every card in English and Russian', () => {
  const cases = [
    {
      locale: 'en',
      t: createTranslator('en'),
      expected: ['📱 Telegram status', '🔐 Approval request', '❌ Tool failed', '❓ Help'],
    },
    {
      locale: 'ru',
      t: createTranslator('ru'),
      expected: ['📱 Статус Telegram', '🔐 Запрос подтверждения', '❌ Ошибка инструмента', '❓ Справка'],
    },
  ];
  for (const { locale, t, expected } of cases) {
    const status = statusCard(
      {
        workspaceId: 'workspace-1',
        workspaceTitle: 'Main',
        sessionId: 'session-1',
        model: { provider: 'deepseek', model: 'deepseek-chat' },
        active: true,
        interactionPending: false,
      },
      t,
    );
    assert.match(status.text, new RegExp(expected[0]));
    assert.doesNotMatch(status.text, CJK, `${locale} 状态卡不得残留中文`);
    assert.match(status.text, /<blockquote>/);

    const approval = approvalCard('req-1', { toolName: 'bash', reason: 'rm -rf' }, t);
    assert.match(approval.text, new RegExp(expected[1]));
    assert.doesNotMatch(approval.text, CJK, `${locale} 审批卡不得残留中文`);
    assert.equal(approval.replyMarkup.inline_keyboard[0][0].callback_data, 'dsh:approval:req-1:approve');

    const failure = toolCard('bash', 'error', { name: 'TypeError' }, {}, t);
    assert.match(failure, new RegExp(expected[2]));
    assert.doesNotMatch(failure, CJK, `${locale} 工具失败卡不得残留中文`);

    const control = controlCard('help', { message: 'x', detail: '/new' }, t);
    assert.match(control.text, new RegExp(expected[3]));
    assert.doesNotMatch(control.text, CJK, `${locale} 控制卡不得残留中文`);

    const workspaces = workspaceCard([{ id: 'w-1', title: 'Main' }], 'w-1', t);
    assert.doesNotMatch(workspaces.text, CJK);
    assert.match(workspaces.text, /w-1/);

    const models = modelListChunks({ current: { provider: 'deepseek', model: 'chat' }, groups: [] }, 4096, t).join('');
    assert.doesNotMatch(models, CJK);
    assert.match(models, /deepseek chat/);

    const tool = toolCardText({ toolName: 'search', status: '执行中' }, t);
    assert.match(tool, /search/);
    assert.doesNotMatch(tool.replace('执行中', ''), CJK);

    const question = interactionCard(
      { id: 'q-1', kind: 'question', payload: { questions: [{ question: 'Pick' }] } },
      t,
    );
    assert.equal(question.text, 'Pick');
  }
});

test('renders localized fallbacks when the upstream payload has no copy', () => {
  const ru = createTranslator('ru');
  const approval = interactionCard({ id: 'a-1', kind: 'approval', payload: {} }, ru);
  assert.equal(approval.text, MESSAGES.ru['approval.prompt.fallback']);
  const question = interactionCard({ id: 'q-1', kind: 'question', payload: {} }, ru);
  assert.equal(question.text, MESSAGES.ru['question.prompt.fallback']);
  assert.equal(approvalCard('a-2', {}, ru).replyMarkup.inline_keyboard[0][0].text, 'Разрешить');
});

test('localizes the Telegram command menu without changing the legacy export', () => {
  const ru = buildTelegramCommands(createTranslator('ru'));
  assert.deepEqual(
    ru.map(({ command }) => command),
    TELEGRAM_COMMANDS.map(({ command }) => command),
  );
  assert.match(ru.find(({ command }) => command === 'model').description, CYRILLIC);
  // 旧导出保持基准语言与同一顺序（按命令名长度升序），注册与既有断言无需感知语言。
  assert.deepEqual(TELEGRAM_COMMANDS, buildTelegramCommands());
  assert.deepEqual(
    TELEGRAM_COMMANDS.map(({ description }) => description),
    ['新建会话', '停止当前任务', '查看帮助', '查看或切换模型', '查看当前状态', '选择或切换 Workspace'],
  );
});

test('carries the language through config normalization', () => {
  const base = { ownerUserId: '456', workspaceId: 'workspace-1', messageLimit: 4096 };
  assert.equal(normalizeConfig(base).language, DEFAULT_LOCALE);
  assert.equal(normalizeConfig({ ...base, language: 'ru-RU' }).language, 'ru');
  assert.equal(normalizeConfig({ ...base, language: 'EN' }).language, 'en');
  assert.equal(normalizeConfig({ ...base, language: 'de' }).language, DEFAULT_LOCALE);
});

test('localizes the streaming tool card', async () => {
  const calls = [];
  let id = 0;
  const transport = {
    async sendText(chatId, text, opts) {
      calls.push(['sendText', text, opts]);
      return { message_id: ++id };
    },
    async editText(chatId, messageId, text) {
      calls.push(['editText', messageId, text]);
    },
    async sendCard(chatId, text) {
      calls.push(['sendCard', text]);
      return { message_id: ++id };
    },
    async editCard() {},
    async deleteMessage() {},
  };
  const stream = new StreamSession({
    transport,
    chatId: '7',
    limit: 4096,
    now: () => 0,
    t: createTranslator('ru'),
  });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c1', name: 'bash' } });
  await stream.finalize();
  const card = calls.find(([kind]) => kind === 'sendCard')?.[1] ?? '';
  assert.match(card, CYRILLIC);
  assert.doesNotMatch(card, CJK);
  assert.match(card, /bash/);
});

test('localizes user-facing errors', () => {
  const ru = createTranslator('ru');
  const en = createTranslator('en');
  assert.match(userFacingError({ code: 429 }, ru), /Слишком много запросов/);
  assert.doesNotMatch(userFacingError({ code: 429 }, ru), CJK);
  assert.match(userFacingError(new Error('some internal token=abc123'), en), /try again later/);
  // 脱敏保证在翻译之后依然成立。
  assert.doesNotMatch(userFacingError(new Error('token=abc123'), ru), /abc123/);
});
