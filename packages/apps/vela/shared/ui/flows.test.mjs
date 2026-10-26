/**
 * Behaviour tests for the shared flows. They run in plain Node: the flows take
 * structural signals and a `CoreClient`-shaped object, so no NSH runtime or
 * Core process is involved.
 */
import assert from 'node:assert/strict';
import { createAuthFlows } from './flows/auth.ts';
import { createPreferencesFlow } from './flows/preferences.ts';
import { createRemoteFlows } from './flows/remotes.ts';
import { createRenameFlow } from './flows/rename.ts';

function sig(value) {
  const read = () => value;
  read.set = (next) => {
    value = next;
  };
  return read;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function quiet() {
  const original = console.error;
  console.error = () => {};
  return () => {
    console.error = original;
  };
}

const messages = {
  startFailed: 'start failed',
  notConnected: 'not connected',
  reconnectFailed: 'reconnect failed',
  recheckFailed: 'recheck failed',
};

// Shared flows publish related fields through one transaction supplied by the
// owning NSH store rather than exposing writable values to pages.
{
  const snapshots = [];
  const pending = sig(false);
  const error = sig('old');
  const auth = createAuthFlows({
    core: {
      startAuth: async () => ({ authUrl: 'https://login.example' }),
      reconnect: async () => ({}),
      logout: async () => {},
    },
    openExternal: () => {},
    pending,
    error,
    rechecking: sig(false),
    load: async () => {},
    isConnected: () => true,
    confirmLogout: async () => false,
    messages,
    tag: 'TEST',
    transaction(run) {
      run();
      snapshots.push([pending(), error()]);
    },
  });
  auth.signIn();
  assert.deepEqual(snapshots, [[true, '']], 'sign-in publishes one coherent pending/error snapshot');
}

// Identity: sign in, settle the pending attempt, re-check, sign out.
{
  const restore = quiet();
  let opened = '';
  let loads = 0;
  let loggedOut = 0;
  const pending = sig(false);
  const error = sig('');
  const rechecking = sig(false);
  const auth = createAuthFlows({
    core: {
      startAuth: async () => ({ authUrl: 'https://login.example' }),
      reconnect: async () => ({ state: 'needs-auth' }),
      logout: async () => {
        loggedOut += 1;
      },
    },
    openExternal: (url) => {
      opened = url;
    },
    pending,
    error,
    rechecking,
    load: async (refresh) => {
      loads += refresh === true ? 2 : 1;
    },
    isConnected: () => true,
    confirmLogout: async () => true,
    messages,
    tag: 'TEST',
  });

  auth.signIn();
  await tick();
  assert.equal(pending(), true, 'signing in keeps the pending state until Core settles');
  assert.equal(opened, 'https://login.example');

  auth.reconnect();
  await tick();
  assert.equal(pending(), false, 'a needs-auth reconnect reveals the sign-in action again');
  assert.equal(rechecking(), false);
  assert.equal(loads, 2, 'reconnect refreshes remote manifests');

  auth.logout();
  await tick();
  assert.equal(loggedOut, 1, 'logout runs after confirmation');
  assert.equal(loads, 3, 'logout reloads the snapshot');
  restore();
}

// Identity: failures surface the platform message and never leave a spinner.
{
  const restore = quiet();
  const pending = sig(false);
  const error = sig('');
  const rechecking = sig(false);
  const auth = createAuthFlows({
    core: {
      startAuth: async () => {
        throw new Error('boom');
      },
      reconnect: async () => {
        throw new Error('offline');
      },
      logout: async () => {},
    },
    openExternal: () => {},
    pending,
    error,
    rechecking,
    load: async () => {},
    isConnected: () => false,
    confirmLogout: async () => true,
    messages,
    tag: 'TEST',
  });

  auth.signIn();
  await tick();
  assert.equal(pending(), false);
  assert.equal(error(), messages.startFailed);

  const renamed = createAuthFlows({
    core: {
      startAuth: async () => ({}),
      reconnect: async () => {
        throw new Error('nope');
      },
      logout: async () => {},
    },
    openExternal: () => {},
    pending: sig(false),
    error,
    rechecking,
    load: async () => {},
    isConnected: () => false,
    confirmLogout: async () => false,
    messages,
    tag: 'TEST',
    onLogoutError: (cause) => error.set(String(cause)),
  });
  renamed.reconnect({ failure: () => 'custom failure' });
  await tick();
  assert.equal(error(), 'custom failure');
  assert.equal(rechecking(), false);

  error.set('');
  renamed.check();
  await tick();
  assert.equal(error(), messages.notConnected, 'check reports an unsettled browser login');
  restore();
}

// Rename: empty and invalid names never reach Core, and a rejected name does
// not leave the form busy.
{
  const status = sig({
    network: 'offline',
    deviceName: 'old-name',
    preferences: {},
    tailscale: { name: 'old-name', ips: [] },
    tailnetDevices: [],
    remotes: [],
  });
  const draft = sig('');
  const error = sig('');
  const busy = sig(false);
  let calls = 0;
  let closed = false;
  const rename = createRenameFlow({
    core: {
      renameDevice: async (name) => {
        calls += 1;
        return { deviceName: name };
      },
    },
    status,
    draft,
    error,
    busy,
    initial: () => 'old-name',
    open: () => {},
    close: () => {
      closed = true;
    },
    messages: { empty: 'empty', invalid: 'invalid' },
  });

  rename.begin();
  assert.equal(draft(), 'old-name');

  draft.set('   ');
  rename.save();
  assert.equal(error(), 'empty');
  assert.equal(busy(), false);

  draft.set('bad name');
  rename.save();
  assert.equal(error(), 'invalid');
  assert.equal(calls, 0, 'an invalid name must not reach Core');
  assert.equal(busy(), false, 'a rejected name must leave the form usable');

  draft.set('vela-2');
  error.set('');
  rename.save();
  await tick();
  assert.equal(calls, 1);
  assert.equal(closed, true);
  assert.equal(status().deviceName, 'vela-2');
  assert.equal(status().tailscale.name, 'vela-2');
  assert.equal(busy(), false);
}

// Saved devices: an empty choice is rejected locally; a submitted name is
// normalised, added, then the platform closes the sheet and reloads.
{
  const restore = quiet();
  const addDevice = { name: sig(''), selection: sig(''), busy: sig(false), error: sig('') };
  let added = '';
  let afterAdd = 0;
  let loads = 0;
  const flows = createRemoteFlows({
    core: {
      addRemote: async (name) => {
        added = name;
      },
      removeRemote: async () => {},
    },
    addDevice,
    load: async () => {
      loads += 1;
    },
    afterAdd: () => {
      afterAdd += 1;
    },
    confirmRemove: async () => true,
    afterConfirmed: () => {},
    messages: { chooseDevice: 'choose' },
    tag: 'TEST',
  });

  flows.submit();
  assert.equal(addDevice.error(), 'choose');

  addDevice.name.set(' Studio.Example.ts.NET ');
  flows.submit();
  await tick();
  assert.equal(added, 'studio.example.ts.net');
  assert.equal(afterAdd, 1);
  assert.equal(loads, 1);
  assert.equal(addDevice.busy(), false);
  restore();
}

// Preferences: applying, snapshot update and persistence happen together.
{
  const restore = quiet();
  const status = sig({
    network: 'offline',
    deviceName: 'name',
    preferences: {
      appearance: 'system',
      performanceHud: false,
      verboseLogs: false,
      gravatarAvatar: false,
      tailscaleProxy: true,
    },
    tailscale: { name: 'name', ips: [] },
    tailnetDevices: [],
    remotes: [],
  });
  let applied = null;
  let sent = null;
  let saved = 0;
  const flow = createPreferencesFlow({
    core: {
      updatePreferences: async (preferences) => {
        sent = preferences;
      },
    },
    status,
    apply: (next) => {
      applied = next;
    },
    onSaved: () => {
      saved += 1;
    },
    tag: 'TEST',
  });

  flow.update({ appearance: 'dark' });
  await tick();
  assert.equal(applied.appearance, 'dark');
  assert.equal(status().preferences.appearance, 'dark');
  assert.equal(sent.appearance, 'dark');
  assert.equal(saved, 1);
  restore();
}

console.log('Vela shared flows pass identity, rename, saved-device and preference scenarios');
