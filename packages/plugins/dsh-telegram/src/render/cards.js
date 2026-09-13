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

export function statusCard({ workspaceId, workspaceTitle, sessionId, model, active, interactionPending }) {
  return panel('📱 Telegram 状态', [
    field('连接', active ? '🟢 运行中' : '⚪ 空闲'),
    field(
      'Workspace',
      `${workspaceTitle ? `${escapeHtml(workspaceTitle)} ` : ''}<code>${escapeHtml(workspaceId)}</code>`,
    ),
    field('Session', `<code>${escapeHtml(sessionId)}</code>`),
    field(
      '模型',
      model?.provider && model?.model ? `<code>${escapeHtml(`${model.provider} ${model.model}`)}</code>` : '未选择',
    ),
    field('任务', active ? '执行中' : '无活动任务'),
    field('交互', interactionPending ? '等待操作' : '无待处理交互'),
  ]);
}

// 模型清单：分组 + 每行一个「点击即复制」的完整命令。
//
// 不用单个 blockquote 包裹整张清单：清单长度不可预测（聚合类 provider 可报上百个模型），
// 而从中间切开会劈断标签。改为按行组装、按行分片，每行的 <code> 自成闭合单元，
// 因此任意分片边界都落在行与行之间，标签永不断裂。
//
// 每行渲染成 <code>/model &lt;provider&gt; &lt;model&gt;</code>：Telegram 的 code 实体
// 点一下就整段复制，复制出来的正好是可直接发送的命令，无需手工拼接。
// provider 因此在每行重复，但那是「一行即一条可用命令」的必要代价。
export function modelListChunks({ current, groups = [] }, limit = 4096) {
  const lines = ['<b>🧠 模型</b>', ''];
  lines.push(
    current?.provider && current?.model
      ? `当前 · <code>${escapeHtml(`${current.provider} ${current.model}`)}</code>`
      : '当前 · 未选择',
  );
  if (groups.length === 0) {
    lines.push('', '没有可用 provider。请先在 dsh 中配置至少一个 provider。');
    return chunkLines(lines, limit);
  }
  for (const group of groups) {
    const id = String(group.id);
    lines.push('');
    // provider 标题用其展示名（更好读），后接 id 供辨识；两者相同时不重复。
    const title = group.name && group.name !== id ? `${escapeHtml(group.name)} · ${escapeHtml(id)}` : escapeHtml(id);
    lines.push(`<b>${title}</b>`);
    if (group.error) {
      lines.push(`  ⚠️ 目录不可用：${escapeHtml(group.error)}`);
      continue;
    }
    if (!group.models || group.models.length === 0) {
      lines.push('  没有已登记的模型。');
      continue;
    }
    for (const model of group.models) {
      const value = `${id} ${String(model)}`;
      const isCurrent = current?.provider === id && String(current?.model) === String(model);
      lines.push(`${isCurrent ? '✓' : ' '} <code>/model ${escapeHtml(value)}</code>`);
    }
  }
  return chunkLines(lines, limit);
}

// 按行累积成不超过 limit 的分片。以行为最小单位，保证每个 <code> 完整落在同一片内。
function chunkLines(lines, limit) {
  const chunks = [];
  let buffer = '';
  for (const line of lines) {
    const candidate = buffer ? `${buffer}\n${line}` : line;
    if (candidate.length > limit && buffer) {
      chunks.push(buffer);
      buffer = line;
      continue;
    }
    buffer = candidate;
  }
  if (buffer) chunks.push(buffer);
  return chunks;
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
    model: '🧠 模型',
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
