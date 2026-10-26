import assert from 'node:assert/strict';
import { createLatestOperation, createTimeoutOwner } from './operations.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

// A promise may settle after its owner stopped; ending it remains idempotent
// and cannot resurrect or underflow the active state.
{
  const changes = [];
  const operation = createLatestOperation((active) => changes.push(active));
  const attempt = operation.begin();
  operation.stop();
  attempt.end();
  attempt.end();
  assert.equal(operation.active(), false);
  assert.equal(attempt.current(), false);
  assert.deepEqual(changes, [true, false]);
}

function fakeClock() {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  let id = 0;
  const pending = new Map();
  globalThis.setTimeout = (run) => {
    const timer = ++id;
    pending.set(timer, run);
    return timer;
  };
  globalThis.clearTimeout = (timer) => pending.delete(timer);
  return {
    runAll() {
      for (const [timer, run] of [...pending]) {
        pending.delete(timer);
        run();
      }
    },
    pending: () => pending.size,
    restore() {
      globalThis.setTimeout = originalSet;
      globalThis.clearTimeout = originalClear;
    },
  };
}

// A later result wins even when the earlier promise settles last. Active state
// remains true until both requests settle, so an old request cannot clear it.
{
  const changes = [];
  const operation = createLatestOperation((active) => changes.push(active));
  const first = deferred();
  const second = deferred();
  const committed = [];

  const run = async (request) => {
    const attempt = operation.begin();
    try {
      const value = await request.promise;
      if (attempt.current()) committed.push(value);
    } finally {
      attempt.end();
    }
  };

  const a = run(first);
  const b = run(second);
  second.resolve('new');
  await b;
  assert.deepEqual(committed, ['new']);
  assert.equal(operation.active(), true, 'the older outstanding request keeps the operation active');
  first.resolve('old');
  await a;
  assert.deepEqual(committed, ['new'], 'an older result must not overwrite the latest result');
  assert.deepEqual(changes, [true, false]);
}

// Stopping an owner invalidates results and cancels every delayed callback.
{
  const clock = fakeClock();
  try {
    const owner = createTimeoutOwner();
    let calls = 0;
    owner.schedule(() => {
      calls += 1;
    }, 10);
    owner.schedule(() => {
      calls += 1;
    }, 20);
    assert.equal(owner.size(), 2);
    owner.stop();
    clock.runAll();
    assert.equal(calls, 0);
    assert.equal(clock.pending(), 0);
  } finally {
    clock.restore();
  }
}

console.log('Vela operations keep latest results and release owned timers');
