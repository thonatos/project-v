import { escapeHtml } from './html.js';

// 统一的「卡片」外观：Telegram HTML 不支持表格/边框，用 <blockquote> 渲染成
// 左侧带竖线的引用块，得到最接近面板且在窄屏/长文本下不崩的效果。
// title 会加粗；lines 为已就绪的内容行（调用方负责对动态值做 escapeHtml）。
// 空行会被过滤，避免引用块里出现突兀的空白行。
function panel(title, lines = []) {
  const body = [`<b>${title}</b>`, ...lines].filter((line) => line !== '' && line != null).join('\n');
  return {
    text: `<blockquote>${body}</blockquote>`,
    parseMode: 'HTML',
  };
}

// 「标签：值」一行。value 已是就绪 HTML（动态段由调用方 escapeHtml）。
function field(label, value) {
  return `${label}：${value}`;
}

const MEDIA_TYPES = new Map([
  ['image', 'image'],
  ['audio', 'audio'],
  ['video', 'video'],
  ['file', 'document'],
  ['document', 'document'],
]);

export function classifyContent(content) {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (!Array.isArray(content)) return [];
  return content.map((block) => {
    const media = MEDIA_TYPES.get(block?.type);
    if (media) return { type: 'media', kind: media, block };
    if (block?.type === 'tool_start' || block?.type === 'tool_update') {
      return { type: 'tool', phase: 'running', block };
    }
    if (block?.type === 'tool_result') return { type: 'tool', phase: 'result', block };
    if (block?.type === 'tool_error') return { type: 'tool', phase: 'error', block };
    if (block?.type === 'approval' || block?.type === 'question') {
      return { type: 'interaction', kind: block.type, block };
    }
    if (block?.type === 'text') return { type: 'text', text: block.text ?? '' };
    return { type: 'unknown', block };
  });
}

export function toolCardText(block) {
  const name = block?.toolName ?? block?.name ?? '工具';
  const status = block?.status ?? (block?.type === 'tool_error' ? '失败' : '执行中');
  const summary = block?.summary ?? block?.text ?? '';
  return `[${status}] ${name}${summary ? `\n${summary}` : ''}`;
}

export function interactionCard(interaction) {
  const payload = interaction?.payload ?? {};
  if (interaction?.kind === 'approval') {
    return {
      text: payload.prompt ?? payload.message ?? '需要审批才能继续。',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '批准', callback_data: `dsh:approval:${interaction.id}:approve` },
            { text: '拒绝', callback_data: `dsh:approval:${interaction.id}:reject` },
          ],
        ],
      },
    };
  }
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  const question = questions[0] ?? payload;
  const options = Array.isArray(question.options) ? question.options : [];
  return {
    text: question.question ?? question.header ?? '请选择一个选项。',
    replyMarkup: {
      inline_keyboard: options.map((option) => [
        {
          text: option.label ?? option.value ?? String(option),
          callback_data: `dsh:question:${interaction.id}:${encodeURIComponent(option.value ?? option.label ?? option)}`,
        },
      ]),
    },
  };
}

export function statusCard({ workspaceId, sessionId, active, interactionPending }) {
  return panel('📱 Telegram 状态', [
    field('连接', active ? '🟢 运行中' : '⚪ 空闲'),
    field('Workspace', `<code>${escapeHtml(workspaceId)}</code>`),
    field('Session', `<code>${escapeHtml(sessionId)}</code>`),
    field('任务', active ? '执行中' : '无活动任务'),
    field('交互', interactionPending ? '等待操作' : '无待处理交互'),
  ]);
}

export function controlCard(command, { message, detail } = {}) {
  const labels = {
    new: '🆕 新会话',
    stop: '🛑 停止任务',
    help: '❓ 帮助',
    unsupported: '⚠️ 不支持的命令',
  };
  return panel(labels[command] ?? '控制命令', [
    message ? escapeHtml(message) : '',
    detail ? `<code>${escapeHtml(detail)}</code>` : '',
  ]);
}

// 流式工具卡片：与 status/control 同款 blockquote 面板，随阶段更新标题。
// 返回纯文本（供 sendCard/editText 使用），parseMode 由调用方统一置为 HTML。
export function toolCard(name, phase, error) {
  const label = escapeHtml(name ?? '工具');
  if (phase === 'running') return panel(`🔧 ${label}`, ['状态：执行中…']).text;
  if (phase === 'error') {
    const detail = error?.name ? `：${escapeHtml(String(error.name))}` : '';
    return panel(`❌ ${label}`, [`状态：失败${detail}`]).text;
  }
  return panel(`✅ ${label}`, ['状态：完成']).text;
}
