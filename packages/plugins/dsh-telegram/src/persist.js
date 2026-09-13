import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';

// Telegram 私聊会话绑定的持久化：走 dsh 官方 storage 子系统（ctx.storageDomain），
// 不再由插件自行向文件系统写状态。表 key 为 Telegram 私聊/会话标识（字符串），
// value 为 { sessionId, workspaceId, provider?, model? }。读同步（内存快照），写异步（backend 落盘）。
//
// provider/model 为私聊级模型选择，声明为 optional，且 version 保持 1 —— 新增 optional
// 字段不是不兼容变更：旧记录缺字段仍通过校验，旧代码读新记录时 zod 会剥离多余字段。
//
// 不要为此 bump version。本 domain 用默认的 `single` layout（整个 unit 一个文档），
// 其 backend 对版本不符是无条件拒绝（`version-mismatch`），且 `compatibleVersions`
// 仅对 `per-record` layout 生效 —— dsh-storage-json 的注释明确写着「the whole-unit
// format rejects instead, because there is exactly one document」。曾在此 bump 到 2
// 并声明 compatibleVersions: [1]，结果既有部署直接启动失败。
// version 只应在存储格式真正不兼容时才动，并同时提供迁移路径。
const BindingValue = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

export const bindingsDomain = defineDomain({
  name: 'telegram_bindings',
  version: 1,
  tables: {
    bindings: domainTable(BindingValue),
  },
});

// 打开 domain 并返回一个与旧 SessionStore 同形的绑定存储句柄。
// 调用方（runtime）持有该句柄，并在停止时调用 close()。
export async function openBindingStore(storageDomain) {
  if (!storageDomain?.open) throw new TypeError('dsh storageDomain service is required');
  const domain = await storageDomain.open(bindingsDomain);
  const table = domain.table('bindings');
  return {
    get(conversationKey) {
      return table.get(String(conversationKey)) ?? null;
    },
    // merge 语义：patch 与已存在记录合并后写回。runtime 的多处写入只带
    // sessionId/workspaceId，若整对象覆盖会静默抹掉 provider/model —— 症状是
    // 「切一次 Workspace 或 resume 失败重建后模型莫名重置」，难复现难归因。
    // 把「保留既有字段」放在这里而非各调用点，消除「调用方必须带全所有字段」这个易错契约。
    // 代价：无法通过 set 表达「删除某字段」。当前无此需求；整条绑定的移除走 delete。
    async set(conversationKey, patch) {
      const key = String(conversationKey);
      const current = table.get(key);
      const next = { ...current, ...stripUndefined(patch) };
      if (!next.sessionId || !next.workspaceId) throw new TypeError('A session binding is required');
      await table.put(key, next);
    },
    async delete(conversationKey) {
      await table.delete(String(conversationKey));
    },
    async close() {
      await domain.close();
    },
  };
}

// 显式传入的 undefined 不应覆盖已存在的值：`{ provider: undefined }` 在展开时
// 会把已有 provider 打成 undefined，与 merge 意图相反。
function stripUndefined(value) {
  const result = {};
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (entry !== undefined) result[key] = entry;
  }
  return result;
}
