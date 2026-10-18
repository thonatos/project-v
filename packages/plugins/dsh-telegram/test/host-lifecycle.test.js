import assert from 'node:assert/strict';
import test from 'node:test';

import { BOT_TOKEN_REF, Config, snapshotConfig } from '../src/config.js';
import { install } from '../src/index.js';
import { RuntimeCoordinator } from '../src/runtime-coordinator.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('declares Loader-editable config fields as volatile and snapshots nested values', () => {
  const schema = Config.toJSON();
  const root = schema.refs[schema.uid];
  for (const field of ['enabled', 'workspaceId', 'ownerUserId', 'messageLimit', 'proxy']) {
    assert.equal(schema.refs[root.dict[field]].meta.volatile, true, `${field} must be volatile`);
  }

  const source = {
    enabled: true,
    workspaceId: 'workspace-1',
    ownerUserId: '7',
    messageLimit: 4096,
    proxy: { type: 'socks5', ip: '127.0.0.1', port: 1080 },
  };
  const snapshot = snapshotConfig(source);
  source.proxy.port = 2080;
  assert.equal(snapshot.proxy.port, 1080);
});

test('snapshots values from Loader volatile refs', () => {
  const ref = (value) => ({ get: () => value });
  assert.deepEqual(
    snapshotConfig({
      enabled: ref(true),
      workspaceId: ref('workspace-1'),
      ownerUserId: ref('7'),
      messageLimit: ref(4096),
      proxy: ref({ type: 'socks5', ip: '127.0.0.1', port: 1080, username: '', password: '' }),
    }),
    {
      enabled: true,
      workspaceId: 'workspace-1',
      ownerUserId: '7',
      messageLimit: 4096,
      proxy: { type: 'socks5', ip: '127.0.0.1', port: 1080, username: '', password: '' },
    },
  );
});

test('host install uses Loader config and reacts only to relevant updates', async () => {
  const listeners = new Map();
  const effects = [];
  const configs = [];
  const stopped = [];
  const configured = [];
  const config = { enabled: true, workspaceId: 'workspace-1', ownerUserId: '7', messageLimit: 4096, proxy: {} };
  const ctx = {
    fiber: { id: 'telegram-fiber' },
    logger: { error() {} },
    settings: {
      configure(value, owner) {
        configured.push([value, owner]);
        return () => {};
      },
    },
    effect(callback) {
      const dispose = callback();
      effects.push(dispose);
      return dispose;
    },
    on(name, callback) {
      listeners.set(name, callback);
    },
  };
  const coordinator = install(ctx, config, {
    createRuntime(value) {
      configs.push(value);
      const id = configs.length;
      return {
        async start() {},
        async stop() {
          stopped.push(id);
        },
      };
    },
  });

  await coordinator.whenSettled();
  assert.deepEqual(configured, [[{ auto: false }, ctx.fiber]]);
  assert.equal(configs.length, 1);

  config.workspaceId = 'workspace-2';
  await listeners.get('loader/volatile-update')([['workspaceId']]);
  assert.equal(configs.at(-1).workspaceId, 'workspace-2');
  assert.deepEqual(stopped, [1]);

  listeners.get('credentials/reference-updated')('OTHER_TOKEN');
  await coordinator.whenSettled();
  assert.equal(configs.length, 2);

  listeners.get('credentials/reference-updated')(BOT_TOKEN_REF);
  await coordinator.whenSettled();
  assert.equal(configs.length, 3);
  assert.deepEqual(stopped, [1, 2]);

  config.enabled = false;
  await listeners.get('loader/volatile-update')([['enabled']]);
  assert.equal(configs.length, 3);
  assert.deepEqual(stopped, [1, 2, 3]);

  await effects.at(-1)();
});

test('runtime coordinator serializes generations and converges on the latest config', async () => {
  const firstStart = deferred();
  const firstEntered = deferred();
  const events = [];
  const config = { enabled: true, workspaceId: 'one', ownerUserId: '7', messageLimit: 4096, proxy: {} };
  let created = 0;
  const coordinator = new RuntimeCoordinator({
    config: () => config,
    logger: { error() {} },
    createRuntime(value) {
      const id = ++created;
      events.push(`create:${id}:${value.workspaceId}`);
      return {
        async start() {
          events.push(`start:${id}`);
          if (id === 1) {
            firstEntered.resolve();
            await firstStart.promise;
          }
        },
        async stop() {
          events.push(`stop:${id}`);
        },
      };
    },
  });

  const first = coordinator.reconcile();
  await firstEntered.promise;
  config.workspaceId = 'two';
  const second = coordinator.reconcile();
  firstStart.resolve();
  await Promise.all([first, second]);

  assert.deepEqual(events, ['create:1:one', 'start:1', 'stop:1', 'create:2:two', 'start:2']);
  await coordinator.dispose();
  assert.equal(events.at(-1), 'stop:2');
});

test('runtime coordinator disposal prevents queued generations from starting', async () => {
  const start = deferred();
  const entered = deferred();
  const events = [];
  const coordinator = new RuntimeCoordinator({
    config: () => ({ enabled: true }),
    logger: { error() {} },
    createRuntime() {
      return {
        async start() {
          events.push('start');
          entered.resolve();
          await start.promise;
        },
        async stop() {
          events.push('stop');
        },
      };
    },
  });

  void coordinator.reconcile();
  await entered.promise;
  void coordinator.reconcile();
  const disposal = coordinator.dispose();
  start.resolve();
  await disposal;

  assert.deepEqual(events, ['start', 'stop']);
  await coordinator.reconcile();
  assert.deepEqual(events, ['start', 'stop']);
});
