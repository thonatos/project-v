import { translate } from '../i18n/index.js';
import { escapeHtml } from './html.js';

// 所有面向用户的文案都取自 i18n 目录（见 ../i18n/messages.js）；渲染函数把
// translator 作为最后一个可选参数，未传入时使用默认语言（zh），既有调用点与测试不变。
//
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
// 分隔符随语言变化（中文全角冒号、西文半角冒号），因此整行也是目录里的一条模板。
function field(label, value, t = translate) {
  return t('common.field', { label, value });
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

export function toolCardText(block, t = translate) {
  const name = block?.toolName ?? block?.name ?? t('tool.name.fallback');
  const status = block?.status ?? (block?.type === 'tool_error' ? t('tool.status.failed') : t('tool.status.running'));
  const summary = block?.summary ?? block?.text ?? '';
  return `[${status}] ${name}${summary ? `\n${summary}` : ''}`;
}

export function interactionCard(interaction, t = translate) {
  const payload = interaction?.payload ?? {};
  if (interaction?.kind === 'approval') {
    return {
      text: payload.prompt ?? payload.message ?? t('approval.prompt.fallback'),
      replyMarkup: {
        inline_keyboard: [
          [
            { text: t('approval.button.approve'), callback_data: `dsh:approval:${interaction.id}:approve` },
            { text: t('approval.button.reject'), callback_data: `dsh:approval:${interaction.id}:reject` },
          ],
        ],
      },
    };
  }
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  const question = questions[0] ?? payload;
  const options = Array.isArray(question.options) ? question.options : [];
  return {
    text: question.question ?? question.header ?? t('question.prompt.fallback'),
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
export function approvalCard(id, { toolName, reason } = {}, t = translate) {
  const lines = [
    field(t('approval.card.tool'), `<code>${escapeHtml(toolName ?? t('approval.card.toolUnknown'))}</code>`, t),
  ];
  if (reason) lines.push(field(t('approval.card.reason'), escapeHtml(String(reason)), t));
  lines.push(t('approval.card.hint'));
  const panelCard = panel(t('approval.card.title'), lines);
  return {
    text: panelCard.text,
    parseMode: panelCard.parseMode,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: t('approval.button.approve'), callback_data: `dsh:approval:${id}:approve` },
          { text: t('approval.button.reject'), callback_data: `dsh:approval:${id}:reject` },
        ],
      ],
    },
  };
}

export function statusCard(
  { workspaceId, workspaceTitle, sessionId, model, active, interactionPending },
  t = translate,
) {
  return panel(t('status.card.title'), [
    field(t('status.card.connection'), active ? t('status.card.connection.live') : t('status.card.connection.idle'), t),
    field(
      t('status.card.workspace'),
      `${workspaceTitle ? `${escapeHtml(workspaceTitle)} ` : ''}<code>${escapeHtml(workspaceId)}</code>`,
      t,
    ),
    field(t('status.card.session'), `<code>${escapeHtml(sessionId)}</code>`, t),
    field(
      t('status.card.model'),
      model?.provider && model?.model
        ? `<code>${escapeHtml(`${model.provider} ${model.model}`)}</code>`
        : t('status.card.model.none'),
      t,
    ),
    field(t('status.card.task'), active ? t('status.card.task.running') : t('status.card.task.idle'), t),
    field(
      t('status.card.interaction'),
      interactionPending ? t('status.card.interaction.pending') : t('status.card.interaction.idle'),
      t,
    ),
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
export function modelListChunks({ current, groups = [] }, limit = 4096, t = translate) {
  const lines = [`<b>${t('model.list.title')}</b>`, ''];
  lines.push(
    current?.provider && current?.model
      ? t('model.list.current', { model: escapeHtml(`${current.provider} ${current.model}`) })
      : t('model.list.current.none'),
  );
  if (groups.length === 0) {
    lines.push('', t('model.list.empty'));
    return chunkLines(lines, limit);
  }
  for (const group of groups) {
    const id = String(group.id);
    lines.push('');
    // provider 标题用其展示名（更好读），后接 id 供辨识；两者相同时不重复。
    const title = group.name && group.name !== id ? `${escapeHtml(group.name)} · ${escapeHtml(id)}` : escapeHtml(id);
    lines.push(`<b>${title}</b>`);
    if (group.error) {
      lines.push(t('model.list.group.error', { error: escapeHtml(group.error) }));
      continue;
    }
    if (!group.models || group.models.length === 0) {
      lines.push(t('model.list.group.empty'));
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

export function workspaceCard(workspaces, currentWorkspaceId, t = translate) {
  const lines = workspaces.map((workspace) => {
    const current = String(workspace.id) === String(currentWorkspaceId);
    return t('workspace.card.line', {
      marker: current ? '●' : '○',
      title: escapeHtml(workspace.title),
      id: escapeHtml(workspace.id),
    });
  });
  const card = panel(t('workspace.card.title'), lines.length > 0 ? lines : [t('workspace.card.empty')]);
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

export function controlCard(command, { message, detail } = {}, t = translate) {
  const labels = {
    new: 'control.new',
    stop: 'control.stop',
    help: 'control.help',
    workspace: 'control.workspace',
    model: 'control.model',
    unsupported: 'control.unsupported',
  };
  return panel(labels[command] ? t(labels[command]) : t('control.card.title'), [
    message ? escapeHtml(message) : '',
    detail ? `<code>${escapeHtml(detail)}</code>` : '',
  ]);
}

// 每轮共用一张临时工具状态卡，避免每次调用都在聊天中留下过程消息。
export function toolCard(name, phase, error, { completed = 0, active = 0 } = {}, t = translate) {
  const label = escapeHtml(name ?? t('tool.name.fallback'));
  if (phase === 'error') {
    const detail = error?.name ? t('tool.card.errorDetail', { name: escapeHtml(String(error.name)) }) : '';
    return panel(t('tool.card.error.title'), [
      field(t('tool.card.field.tool'), `<code>${label}</code>`, t),
      t('tool.card.status.failed', { detail }),
    ]).text;
  }
  const progress = t('tool.card.progress', {
    completed,
    active: active > 1 ? t('tool.card.progress.active', { active }) : '',
  });
  if (phase === 'done') {
    return panel(t('tool.card.title'), [field(t('tool.card.field.progress'), progress, t), t('tool.card.finishing')])
      .text;
  }
  return panel(t('tool.card.title'), [
    field(t('tool.card.field.current'), `<code>${label}</code>`, t),
    field(t('tool.card.field.progress'), progress, t),
  ]).text;
}
