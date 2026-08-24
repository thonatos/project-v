import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class SessionStore {
  #path;
  #bindings = new Map();
  #write = Promise.resolve();

  constructor(path) {
    if (typeof path !== 'string' || !path) throw new TypeError('SessionStore path is required');
    this.#path = path;
  }

  async load() {
    try {
      const document = JSON.parse(await readFile(this.#path, 'utf8'));
      for (const [key, value] of Object.entries(document?.bindings ?? {})) {
        if (typeof value?.sessionId === 'string' && typeof value?.workspaceId === 'string') {
          this.#bindings.set(key, { sessionId: value.sessionId, workspaceId: value.workspaceId });
        }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return this;
  }

  get(conversationKey) {
    return this.#bindings.get(String(conversationKey)) ?? null;
  }

  async set(conversationKey, binding) {
    if (!binding?.sessionId || !binding?.workspaceId) throw new TypeError('A session binding is required');
    this.#bindings.set(String(conversationKey), Object.freeze({ ...binding }));
    await this.#persist();
  }

  async delete(conversationKey) {
    this.#bindings.delete(String(conversationKey));
    await this.#persist();
  }

  async clearWorkspace(workspaceId) {
    for (const [key, binding] of this.#bindings) {
      if (binding.workspaceId !== workspaceId) this.#bindings.delete(key);
    }
    await this.#persist();
  }

  async #persist() {
    this.#write = this.#write.then(async () => {
      await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
      const temporary = `${this.#path}.tmp`;
      const bindings = Object.fromEntries(this.#bindings);
      await writeFile(temporary, `${JSON.stringify({ version: 1, bindings }, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, this.#path);
    });
    return this.#write;
  }

  async remove() {
    await this.#write;
    await unlink(this.#path).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
}
