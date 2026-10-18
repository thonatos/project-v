import assert from 'node:assert/strict';
import { test } from 'vite-plus/test';

import { apply, inject, settingsEditorState, TelegramSettingsCard } from '../src/client.js';

function context() {
  const calls = [];
  const workspaceList = { getSnapshot() {}, subscribe() {} };
  const ctx = {
    remote: { credentials: {} },
    workspaces: { list: workspaceList },
    effect(callback) {
      return callback();
    },
    slots: {
      inject(name, register) {
        calls.push(['inject', name]);
        return register();
      },
      register(options, component) {
        calls.push(['register', options, component]);
        return () => {};
      },
    },
  };
  return { calls, ctx, workspaceList };
}

test('registers the Telegram editor on its Plugin Manager row while the namespace is served', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return { remove() {} };
    },
    head: { append() {} },
  };
  const { calls, ctx, workspaceList } = context();

  try {
    apply(ctx);

    assert.deepEqual(inject, ['remote', 'remote.credentials', 'slots', 'workspaces']);
    assert.deepEqual(calls[0], ['inject', 'plugins.row.config']);
    assert.equal(calls[1][1].name, 'plugins.row.config');
    assert.equal(calls[1][1].key, '@implementsio/dsh-telegram#dsh-telegram');
    assert.deepEqual(calls[1][1].inject(), { credentialsApi: ctx.remote.credentials, workspaceList });
  } finally {
    globalThis.document = previousDocument;
  }
});

test('projects loading, ready and readonly editor states', () => {
  assert.deepEqual(
    settingsEditorState({ status: 'loading', writable: false }, { state: 'loading', phase: 'pending' }),
    {
      loading: true,
      writable: false,
      workspaceLoading: true,
    },
  );
  assert.deepEqual(settingsEditorState({ status: 'ready', writable: false }, { state: 'idle', phase: 'ready' }), {
    loading: false,
    writable: false,
    workspaceLoading: false,
  });
  assert.deepEqual(settingsEditorState({ status: 'ready', writable: true }, { state: 'idle', phase: 'ready' }), {
    loading: false,
    writable: true,
    workspaceLoading: false,
  });
});

test('renders a summary face and a page editor face', () => {
  const summary = TelegramSettingsCard({ view: 'summary' });
  const page = TelegramSettingsCard({
    view: 'page',
    credentialsApi: {},
    form: { state: { status: 'loading' }, mutate() {} },
    workspaceList: {},
  });
  assert.equal(summary.type, 'span');
  assert.match(summary.props.children, /Telegram Bot API/);
  assert.equal(typeof page.type, 'function');
});
