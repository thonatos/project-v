import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';

// Telegram 私聊会话绑定的持久化：走 dsh 官方 storage 子系统（ctx.storageDomain），
// 不再由插件自行向文件系统写状态。表 key 为 Telegram 私聊/会话标识（字符串），
// value 为 { sessionId, workspaceId }。读同步（内存快照），写异步（backend 落盘）。
const BindingValue = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
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
    async set(conversationKey, binding) {
      if (!binding?.sessionId || !binding?.workspaceId) throw new TypeError('A session binding is required');
      await table.put(String(conversationKey), { sessionId: binding.sessionId, workspaceId: binding.workspaceId });
    },
    async delete(conversationKey) {
      await table.delete(String(conversationKey));
    },
    async close() {
      await domain.close();
    },
  };
}
