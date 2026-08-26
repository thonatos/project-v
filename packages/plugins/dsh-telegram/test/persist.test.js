import test from 'node:test';
import assert from 'node:assert/strict';
import { openBindingStore, bindingsDomain } from '../src/persist.js';

// 内存版 storageDomain：模拟 dsh storage 子系统的 open→domain→table 契约，
// 表数据存在外部 Map 里，使「重开同一 domain」能恢复已写入的绑定。
function makeStorageDomain() {
  const store = new Map(); // domainName -> Map(tableName -> Map(key -> value))
  const opened = [];
  return {
    opened,
    async open(spec) {
      opened.push(spec.name);
      const tables = store.get(spec.name) ?? new Map();
      store.set(spec.name, tables);
      return {
        name: spec.name,
        table(tableName) {
          const rows = tables.get(tableName) ?? new Map();
          tables.set(tableName, rows);
          return {
            get: (key) => rows.get(key),
            entries: () => rows.entries(),
            keys: () => rows.keys(),
            get size() {
              return rows.size;
            },
            async put(key, value) {
              rows.set(key, value);
            },
            async delete(key) {
              return rows.delete(key);
            },
          };
        },
        async close() {},
      };
    },
  };
}

test('openBindingStore requires a storageDomain', async () => {
  await assert.rejects(() => openBindingStore(undefined), /storageDomain/);
});

test('declares the telegram_bindings domain with a bindings table', () => {
  assert.equal(bindingsDomain.name, 'telegram_bindings');
  assert.equal(bindingsDomain.version, 1);
  assert.ok(bindingsDomain.tables.bindings);
});

test('sets, reads and deletes a binding', async () => {
  const storageDomain = makeStorageDomain();
  const bindings = await openBindingStore(storageDomain);
  assert.equal(bindings.get('123'), null);
  await bindings.set('123', { sessionId: 'session-1', workspaceId: 'workspace-1' });
  assert.deepEqual(bindings.get('123'), { sessionId: 'session-1', workspaceId: 'workspace-1' });
  await bindings.delete('123');
  assert.equal(bindings.get('123'), null);
});

test('rejects an incomplete binding', async () => {
  const bindings = await openBindingStore(makeStorageDomain());
  await assert.rejects(() => bindings.set('1', { sessionId: 'only-session' }), /session binding/);
});

test('recovers bindings after reopening the same domain', async () => {
  const storageDomain = makeStorageDomain();
  const first = await openBindingStore(storageDomain);
  await first.set('456', { sessionId: 'session-2', workspaceId: 'workspace-2' });
  await first.close();
  // 模拟 runtime 重启：重新 open 同一 domain，应恢复既有绑定。
  const second = await openBindingStore(storageDomain);
  assert.deepEqual(second.get('456'), { sessionId: 'session-2', workspaceId: 'workspace-2' });
  assert.equal(storageDomain.opened.length, 2);
});
