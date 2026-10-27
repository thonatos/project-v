import assert from 'node:assert/strict';
import { createAppcast } from '../scripts/release/update-feed.mjs';
import { publishFeed } from '../scripts/release/publish-update-feed.mjs';

const appcast = (build) =>
  createAppcast({
    release: { version: `0.${build}.0`, build: String(build), minimumSystemVersion: '14.0', artifact: { size: 10 } },
    signature: { signature: 'fixture', length: 10 },
    downloadUrl: 'https://example.test/Vela.zip',
    notesUrl: 'https://example.test/notes.md',
    publishedAt: '2026-10-27T00:00:00Z',
  });

class MemoryApi {
  constructor() {
    this.ref = undefined;
    this.files = new Map();
    this.counter = 0;
    this.updated = 0;
  }
  async getRef() {
    if (!this.ref) {
      const error = new Error('missing');
      error.status = 404;
      throw error;
    }
    return { sha: this.ref };
  }
  async readFile(ref) {
    return this.files.get(ref);
  }
  async createBlob(content) {
    this.pending = content;
    return { sha: `blob-${++this.counter}` };
  }
  async createTree() {
    return { sha: `tree-${++this.counter}` };
  }
  async createCommit() {
    const sha = `commit-${++this.counter}`;
    this.files.set(sha, this.pending);
    return { sha };
  }
  async createRef(_branch, sha) {
    if (this.ref) throw new Error('exists');
    this.ref = sha;
  }
  async updateRef(_branch, sha, expected) {
    if (this.ref !== expected) throw new Error('vela-updates ref changed concurrently');
    this.ref = sha;
    this.updated += 1;
  }
}

const api = new MemoryApi();
const created = await publishFeed({ api, xml: appcast(3), baseCommit: 'main-sha' });
assert.equal(created.status, 'created');
const unchanged = await publishFeed({ api, xml: appcast(3), baseCommit: 'main-sha' });
assert.equal(unchanged.status, 'unchanged');
assert.equal(api.updated, 0);
await assert.rejects(() => publishFeed({ api, xml: appcast(2), baseCommit: 'main-sha' }), /降级/);
const previous = api.ref;
const updated = await publishFeed({ api, xml: appcast(4), baseCommit: 'main-sha', expectedRef: previous });
assert.equal(updated.status, 'updated');
assert.equal(api.updated, 1);
await assert.rejects(
  () => publishFeed({ api, xml: appcast(5), baseCommit: 'main-sha', expectedRef: previous }),
  /concurrently/,
);
assert.equal(api.files.get(api.ref), appcast(4), '并发失败必须保留旧 feed');

console.log('Vela feed compare-and-swap publishing passed');
