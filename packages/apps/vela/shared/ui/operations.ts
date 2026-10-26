/**
 * Tracks one replaceable asynchronous operation. Only the newest revision may
 * publish state, and stopping the owner invalidates every outstanding result.
 */
export function createLatestOperation(onActiveChange?: (active: boolean) => void) {
  let revision = 0;
  let stopped = false;
  const active = new Set<number>();

  function begin() {
    stopped = false;
    const current = ++revision;
    active.add(current);
    if (active.size === 1) onActiveChange?.(true);
    let ended = false;
    return {
      current: () => !stopped && current === revision,
      end() {
        if (ended) return;
        ended = true;
        const removed = active.delete(current);
        if (removed && active.size === 0) onActiveChange?.(false);
      },
    };
  }

  function stop() {
    stopped = true;
    revision += 1;
    active.clear();
    onActiveChange?.(false);
  }

  return { begin, stop, active: () => active.size > 0 };
}

/** Owns timeouts so a store or component can cancel all delayed work at once. */
export function createTimeoutOwner() {
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function schedule(run: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function cancel(timer: ReturnType<typeof setTimeout> | undefined) {
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(timer);
  }

  function stop() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  }

  return { schedule, cancel, stop, size: () => timers.size };
}
