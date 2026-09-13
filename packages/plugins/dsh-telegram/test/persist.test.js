import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { descriptorOf } from '@deepseek-ai/dsh-storage-domain';
import { openBindingStore, bindingsDomain } from '../src/persist.js';

// 内存版 storageDomain：模拟 dsh storage 子系统的 open→domain→table 契约，
// 表数据存在外部 Map 里，使「重开同一 domain」能恢复已写入的绑定。
//
// 关键：必须复刻真实 backend 的版本戳检查。曾因 mock 不查版本，导致「bump version +
// compatibleVersions」的改动在全部单测通过的情况下上线即启动失败
// （`stored version 1 != expected 2`）—— compatibleVersions 只对 per-record layout
// 生效，而本 domain 是 single layout，其 backend 无条件比对版本。
function makeStorageDomain({ storedVersion } = {}) {
  const store = new Map(); // domainName -> Map(tableName -> Map(key -> value))
  const versions = new Map(); // domainName -> 已落盘的版本戳
  const opened = [];
  return {
    opened,
    // 预置一条记录，用于模拟 open 之前就已落盘的（含旧版本）数据。
    seed(domainName, tableName, key, value) {
      const tables = store.get(domainName) ?? new Map();
      store.set(domainName, tables);
      const rows = tables.get(tableName) ?? new Map();
      tables.set(tableName, rows);
      rows.set(String(key), value);
      if (!versions.has(domainName)) versions.set(domainName, storedVersion ?? undefined);
    },
    async open(spec) {
      opened.push(spec.name);
      // single layout 的真实行为：已落盘版本与期望不符即拒绝整个 unit，
      // compatibleVersions 不参与判断。
      const stored = versions.get(spec.name);
      if (stored !== undefined && stored !== spec.version) {
        const error = new Error(`unit '${spec.name}': stored version ${stored} != expected ${spec.version}`);
        error.code = 'version-mismatch';
        throw error;
      }
      versions.set(spec.name, spec.version);
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
  // version 必须保持 1：本 domain 是 `single` layout，其 backend 对版本不符无条件拒绝，
  // 且 compatibleVersions 只对 `per-record` layout 生效。新增 optional 字段不是不兼容
  // 变更，bump version 会让既有部署直接启动失败（version-mismatch）。
  assert.equal(bindingsDomain.version, 1);
  assert.equal(bindingsDomain.compatibleVersions, undefined);
  assert.notEqual(bindingsDomain.layout, 'per-record');
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

test('set merges into the existing binding instead of overwriting it', async () => {
  // 回归锁定：runtime 的三处绑定写入只带 sessionId/workspaceId。若 set 是整对象覆盖，
  // 任意一次 Workspace 切换或 resume 失败重建都会静默抹掉模型选择，回落全局默认且无提示。
  const bindings = await openBindingStore(makeStorageDomain());
  await bindings.set('123', {
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
  // 只带 sessionId/workspaceId 的后续写入必须保留 provider/model。
  await bindings.set('123', { sessionId: 'session-2', workspaceId: 'workspace-2' });
  assert.deepEqual(bindings.get('123'), {
    sessionId: 'session-2',
    workspaceId: 'workspace-2',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
});

test('set accepts a model-only patch on an existing binding', async () => {
  const bindings = await openBindingStore(makeStorageDomain());
  await bindings.set('123', { sessionId: 'session-1', workspaceId: 'workspace-1' });
  await bindings.set('123', { provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' });
  assert.deepEqual(bindings.get('123'), {
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.5',
  });
});

test('rejects a model-only patch when no binding exists yet', async () => {
  const bindings = await openBindingStore(makeStorageDomain());
  await assert.rejects(() => bindings.set('123', { provider: 'deepseek', model: 'x' }), /session binding/);
});

test('delete removes the model selection along with the binding', async () => {
  const bindings = await openBindingStore(makeStorageDomain());
  await bindings.set('123', {
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
  await bindings.delete('123');
  assert.equal(bindings.get('123'), null);
  // 删除后重建不得复活旧的模型选择。
  await bindings.set('123', { sessionId: 'session-2', workspaceId: 'workspace-1' });
  assert.deepEqual(bindings.get('123'), { sessionId: 'session-2', workspaceId: 'workspace-1' });
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

test('reads a pre-existing record that lacks the model fields', async () => {
  // 加字段前写下的记录没有 provider/model。两者声明为 optional，因此仍通过校验；
  // 又因 version 未变，backend 的版本戳检查也不会拒绝整个 unit。
  const storageDomain = makeStorageDomain();
  storageDomain.seed('telegram_bindings', 'bindings', '789', {
    sessionId: 'legacy-session',
    workspaceId: 'legacy-workspace',
  });
  const bindings = await openBindingStore(storageDomain);
  const legacy = bindings.get('789');
  assert.equal(legacy.sessionId, 'legacy-session');
  assert.equal(legacy.provider, undefined);
  assert.equal(legacy.model, undefined);
  // 旧记录之上写入模型选择应成功，且保留原有字段。
  await bindings.set('789', { provider: 'deepseek', model: 'deepseek-reasoner' });
  assert.deepEqual(bindings.get('789'), {
    sessionId: 'legacy-session',
    workspaceId: 'legacy-workspace',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
});

test('opens a store whose stored records were stamped by the shipped version', async () => {
  // 回归锁定真实事故：曾把 version bump 到 2 并声明 compatibleVersions: [1]，
  // 既有部署启动即报 `unit 'telegram_bindings': stored version 1 != expected 2`。
  // 根因是 single layout 的 backend 无条件比对版本戳，compatibleVersions 对它无效。
  // 已落盘数据的版本戳是 1，因此 domain 的 version 必须保持 1。
  const storageDomain = makeStorageDomain({ storedVersion: 1 });
  storageDomain.seed('telegram_bindings', 'bindings', '1344500783', {
    sessionId: 'telegram-existing',
    workspaceId: 'workspace-1',
  });
  const bindings = await openBindingStore(storageDomain);
  assert.equal(bindings.get('1344500783').sessionId, 'telegram-existing');
  // 加字段不需要 bump version：两个新字段为 optional，旧记录仍合法。
  await bindings.set('1344500783', { provider: 'deepseek', model: 'deepseek-reasoner' });
  assert.equal(bindings.get('1344500783').model, 'deepseek-reasoner');
});

test('the domain schema accepts records with and without the model fields', () => {
  const descriptor = descriptorOf(bindingsDomain);
  assert.equal(descriptor.version, 1, 'single layout 下 bump version 会让既有部署无法启动');
  const schema = bindingsDomain.tables.bindings.valueSchema;
  assert.ok(schema.safeParse({ sessionId: 's', workspaceId: 'w' }).success);
  assert.ok(schema.safeParse({ sessionId: 's', workspaceId: 'w', provider: 'p', model: 'm' }).success);
});

test('an older schema strips the added fields instead of rejecting the record', () => {
  // 反向兼容：回滚到不含 provider/model 的旧代码后，它读到的新记录会被 zod 剥离
  // 多余键而非拒绝 —— 因此回滚是安全的，最坏情况仅丢失模型选择。
  const legacySchema = z.object({ sessionId: z.string(), workspaceId: z.string() });
  const parsed = legacySchema.parse({
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
  assert.deepEqual(parsed, { sessionId: 'session-1', workspaceId: 'workspace-1' });
});
