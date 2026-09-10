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
      inline_keyboard: options.map((option, index) => [
        {
          text: option.label ?? option.value ?? String(option),
          callback_data: `dsh:question:${interaction.id}:${index}`,
        },
      ]),
    },
  };
}

// 审批卡片：dsh-user-approval `approval/request` 到达时渲染成带「批准/拒绝」按钮的
// 面板。callback_data 用 `dsh:approval:<id>:approve|reject`，与 #handleCallbackQuery
// 的解析格式一致。toolName/reason 为动态值，转义后再拼入。
export function approvalCard(id, { toolName, reason } = {}) {
  const lines = [field('工具', `<code>${escapeHtml(toolName ?? '未知')}</code>`)];
  if (reason) lines.push(field('原因', escapeHtml(String(reason))));
  lines.push('需要你的批准才能继续。');
  const panelCard = panel('🔐 审批请求', lines);
  return {
    text: panelCard.text,
    parseMode: panelCard.parseMode,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '批准', callback_data: `dsh:approval:${id}:approve` },
          { text: '拒绝', callback_data: `dsh:approval:${id}:reject` },
        ],
      ],
    },
  };
}

export function statusCard({ workspaceId, workspaceTitle, sessionId, active, interactionPending }) {
  return panel('📱 Telegram 状态', [
    field('连接', active ? '🟢 运行中' : '⚪ 空闲'),
    field(
      'Workspace',
      `${workspaceTitle ? `${escapeHtml(workspaceTitle)} ` : ''}<code>${escapeHtml(workspaceId)}</code>`,
    ),
    field('Session', `<code>${escapeHtml(sessionId)}</code>`),
    field('任务', active ? '执行中' : '无活动任务'),
    field('交互', interactionPending ? '等待操作' : '无待处理交互'),
  ]);
}

export function workspaceCard(workspaces, currentWorkspaceId) {
  const lines = workspaces.map((workspace) => {
    const current = String(workspace.id) === String(currentWorkspaceId);
    return `${current ? '●' : '○'} ${escapeHtml(workspace.title)}：<code>${escapeHtml(workspace.id)}</code>`;
  });
  const card = panel('🗂 Workspace', lines.length > 0 ? lines : ['没有已登记的 Workspace。']);
  return {
    ...card,
    replyMarkup: {
      inline_keyboard: workspaces
        .map((workspace) => {
          const id = String(workspace.id);
          const callbackData = `dsh:workspace:select:${encodeURIComponent(id)}`;
          if (Buffer.byteLength(callbackData, 'utf8') > 64) return null;
          const current = id === String(currentWorkspaceId);
          return [
            {
              text: `${current ? '✓ ' : ''}${workspace.title}`,
              callback_data: callbackData,
            },
          ];
        })
        .filter(Boolean),
    },
  };
}

export function controlCard(command, { message, detail } = {}) {
  const labels = {
    new: '🆕 新会话',
    stop: '🛑 停止任务',
    help: '❓ 帮助',
    workspace: '🗂 Workspace',
    unsupported: '⚠️ 不支持的命令',
  };
  return panel(labels[command] ?? '控制命令', [
    message ? escapeHtml(message) : '',
    detail ? `<code>${escapeHtml(detail)}</code>` : '',
  ]);
}

// 每轮共用一张临时工具状态卡，避免每次调用都在聊天中留下过程消息。
export function toolCard(name, phase, error, { completed = 0, active = 0 } = {}) {
  const label = escapeHtml(name ?? '工具');
  if (phase === 'error') {
    const detail = error?.name ? `：${escapeHtml(String(error.name))}` : '';
    return panel('❌ 工具执行失败', [field('工具', `<code>${label}</code>`), `状态：失败${detail}`]).text;
  }
  const progress = `${completed} 个工具调用已完成${active > 1 ? ` · ${active} 个执行中` : ''}`;
  if (phase === 'done') return panel('🔧 任务执行中', [field('进度', progress), '正在整理结果…']).text;
  return panel('🔧 任务执行中', [field('当前', `<code>${label}</code>`), field('进度', progress)]).text;
}
