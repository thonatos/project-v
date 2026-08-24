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
  return {
    text: [
      '<b>Telegram 状态</b>',
      '',
      `<b>连接</b>：${active ? '运行中' : '空闲'}`,
      `<b>Workspace</b>：<code>${escapeHtml(workspaceId)}</code>`,
      `<b>Session</b>：<code>${escapeHtml(sessionId)}</code>`,
      `<b>任务</b>：${active ? '执行中' : '无活动任务'}`,
      `<b>交互</b>：${interactionPending ? '等待操作' : '无待处理交互'}`,
    ].join('\n'),
    parseMode: 'HTML',
  };
}

export function controlCard(command, { message, detail } = {}) {
  const labels = { new: '新会话', stop: '停止任务', help: '帮助', unsupported: '不支持的命令' };
  return {
    text: [
      `<b>${labels[command] ?? '控制命令'}</b>`,
      '',
      message ? escapeHtml(message) : '',
      detail ? `<pre>${escapeHtml(detail)}</pre>` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    parseMode: 'HTML',
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
