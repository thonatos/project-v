import { snapshotConfig } from './config.js';

export class RuntimeCoordinator {
  #config;
  #createRuntime;
  #logger;
  #runtime;
  #tail = Promise.resolve();
  #generation = 0;
  #disposed = false;

  constructor({ config, createRuntime, logger = console }) {
    this.#config = config;
    this.#createRuntime = createRuntime;
    this.#logger = logger;
  }

  reconcile() {
    if (this.#disposed) return this.#tail;
    const generation = ++this.#generation;
    this.#tail = this.#tail.then(() => this.#run(generation));
    return this.#tail;
  }

  async dispose() {
    if (this.#disposed) return this.#tail;
    this.#disposed = true;
    ++this.#generation;
    this.#tail = this.#tail.then(() => this.#stopCurrent());
    return this.#tail;
  }

  whenSettled() {
    return this.#tail;
  }

  async #run(generation) {
    await this.#stopCurrent();
    if (this.#disposed || generation !== this.#generation) return;

    const config = snapshotConfig(this.#config());
    if (!config.enabled) return;

    let candidate;
    try {
      candidate = this.#createRuntime(config);
      await candidate.start();
    } catch (error) {
      await candidate?.stop?.().catch((stopError) => this.#report('failed to clean up runtime', stopError));
      this.#report('failed to start', error);
      return;
    }

    if (this.#disposed || generation !== this.#generation) {
      await candidate.stop();
      return;
    }
    this.#runtime = candidate;
  }

  async #stopCurrent() {
    const runtime = this.#runtime;
    this.#runtime = undefined;
    if (!runtime) return;
    try {
      await runtime.stop();
    } catch (error) {
      this.#report('failed to stop', error);
    }
  }

  #report(action, error) {
    const message = error instanceof Error ? error.message : String(error);
    this.#logger.error?.(`[dsh-telegram] ${action}: ${message}`);
  }
}
