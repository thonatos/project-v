import assert from 'node:assert/strict';
import { test } from 'vite-plus/test';
import { getCredentialsApi, readCredentialStatuses, saveTelegramSettings } from '../src/client-credentials.js';

const refs = { botToken: 'DSH_TELEGRAM_BOT_TOKEN', optional: 'OPTIONAL_TOKEN' };

test('resolves the credentials API from the current remote service', () => {
  const credentials = { describe() {}, set() {} };
  assert.equal(getCredentialsApi({ remote: { credentials } }), credentials);
  assert.throws(() => getCredentialsApi({}), /无法读取 Telegram 凭据状态/);
});

test('reads configured credential statuses with the positional refs argument', async () => {
  const calls = [];
  const statuses = await readCredentialStatuses(
    {
      async describe(requestedRefs) {
        calls.push(requestedRefs);
        return {
          ok: true,
          value: {
            DSH_TELEGRAM_BOT_TOKEN: { configured: true, source: 'file', writable: true },
          },
        };
      },
    },
    refs,
  );

  assert.deepEqual(calls, [['DSH_TELEGRAM_BOT_TOKEN', 'OPTIONAL_TOKEN']]);
  assert.deepEqual(statuses, { botToken: true, optional: false });
});

test('writes a credential with positional arguments and enables only after refreshing status', async () => {
  const calls = [];
  const form = {
    async mutate(ops, revision) {
      calls.push(['settings', ops, revision]);
      return true;
    },
  };
  const credentialsApi = {
    async set(ref, value) {
      calls.push(['credential', ref, value]);
      return { ok: true, value: undefined };
    },
    async describe(requestedRefs) {
      calls.push(['describe', requestedRefs]);
      return {
        ok: true,
        value: { DSH_TELEGRAM_BOT_TOKEN: { configured: true, writable: true } },
      };
    },
  };

  const statuses = await saveTelegramSettings({
    credentialsApi,
    mutate: form.mutate,
    revision: 4,
    values: { enabled: true, workspaceId: 'workspace-1' },
    secrets: { botToken: '  new-token  ' },
    refs: { botToken: refs.botToken },
  });

  assert.deepEqual(statuses, { botToken: true });
  assert.deepEqual(calls, [
    ['credential', 'DSH_TELEGRAM_BOT_TOKEN', 'new-token'],
    ['describe', ['DSH_TELEGRAM_BOT_TOKEN']],
    [
      'settings',
      [
        { op: 'set', path: ['enabled'], value: true },
        { op: 'set', path: ['workspaceId'], value: 'workspace-1' },
      ],
      4,
    ],
  ]);
});

test('redacts a failed RemoteResult and does not re-enable Telegram', async () => {
  const secret = 'secret-that-must-not-leak';
  let mutations = 0;
  const operation = saveTelegramSettings({
    credentialsApi: {
      async set() {
        return { ok: false, error: { message: `rejected ${secret}` } };
      },
    },
    mutate: async () => {
      mutations += 1;
      return true;
    },
    values: { enabled: true },
    secrets: { botToken: secret },
    refs: { botToken: refs.botToken },
  });

  await assert.rejects(operation, (error) => {
    assert.match(error.message, /无法保存 Telegram Bot Token/);
    assert.doesNotMatch(error.message, new RegExp(secret));
    return true;
  });
  assert.equal(mutations, 0);
});

test('reports a revision conflict after credentials are confirmed', async () => {
  await assert.rejects(
    () =>
      saveTelegramSettings({
        credentialsApi: {
          async describe() {
            return { ok: true, value: { DSH_TELEGRAM_BOT_TOKEN: { configured: true } } };
          },
        },
        mutate: async () => false,
        revision: 8,
        values: { enabled: true },
        secrets: { botToken: '' },
        refs: { botToken: refs.botToken },
      }),
    /配置已变化/,
  );
});

test('redacts thrown credential read errors', async () => {
  const secret = 'read-secret-that-must-not-leak';
  await assert.rejects(
    () =>
      readCredentialStatuses(
        {
          async describe() {
            throw new Error(`provider failed with ${secret}`);
          },
        },
        { botToken: refs.botToken },
      ),
    (error) => {
      assert.match(error.message, /无法读取 Telegram 凭据状态/);
      assert.doesNotMatch(error.message, new RegExp(secret));
      return true;
    },
  );
});
