#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FEED_PATH, feedBuild } from './update-feed.mjs';

const BRANCH = 'vela-updates';

export async function publishFeed({ api, xml, baseCommit, expectedRef }) {
  const targetBuild = feedBuild(xml);
  if (!targetBuild) throw new Error('appcast 缺少有效 Apple build');
  let current;
  try {
    current = await api.getRef(BRANCH);
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  if (!current) {
    const blob = await api.createBlob(xml);
    const tree = await api.createTree(baseCommit, FEED_PATH, blob.sha);
    const commit = await api.createCommit(`Publish Vela stable appcast build ${targetBuild}`, tree.sha, baseCommit);
    await api.createRef(BRANCH, commit.sha);
    return { status: 'created', build: targetBuild, commit: commit.sha };
  }
  if (expectedRef && current.sha !== expectedRef) throw new Error('vela-updates ref changed concurrently');
  const previous = await api.readFile(current.sha, FEED_PATH);
  const currentBuild = previous ? feedBuild(previous) : 0;
  if (targetBuild < currentBuild) throw new Error(`拒绝从 build ${currentBuild} 降级到 ${targetBuild}`);
  if (targetBuild === currentBuild) return { status: 'unchanged', build: targetBuild, commit: current.sha };
  const blob = await api.createBlob(xml);
  const tree = await api.createTree(current.sha, FEED_PATH, blob.sha);
  const commit = await api.createCommit(`Publish Vela stable appcast build ${targetBuild}`, tree.sha, current.sha);
  await api.updateRef(BRANCH, commit.sha, current.sha);
  return { status: 'updated', build: targetBuild, commit: commit.sha };
}

export function githubApi({ repository, token, fetchImpl = fetch }) {
  if (!/^[^/]+\/[^/]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY 无效');
  const request = async (method, endpoint, body) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${endpoint}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const error = new Error(`GitHub API ${method} ${endpoint}: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? {} : response.json();
  };
  return {
    getRef: async (branch) => {
      const value = await request('GET', `/git/ref/heads/${branch}`);
      return { sha: value.object.sha };
    },
    readFile: async (ref, file) => {
      try {
        const value = await request('GET', `/contents/${file}?ref=${encodeURIComponent(ref)}`);
        return Buffer.from(value.content, 'base64').toString('utf8');
      } catch (error) {
        if (error.status === 404) return undefined;
        throw error;
      }
    },
    createBlob: (content) => request('POST', '/git/blobs', { content, encoding: 'utf-8' }),
    createTree: (_base, file, blob) =>
      request('POST', '/git/trees', { tree: [{ path: file, mode: '100644', type: 'blob', sha: blob }] }),
    createCommit: (message, tree, parent) => request('POST', '/git/commits', { message, tree, parents: [parent] }),
    createRef: (branch, sha) => request('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha }),
    updateRef: async (branch, sha, expected) => {
      const current = await request('GET', `/git/ref/heads/${branch}`);
      if (current.object.sha !== expected) throw new Error('vela-updates ref changed concurrently');
      return request('PATCH', `/git/refs/heads/${branch}`, { sha, force: false });
    },
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 2) options.set(argv[index], argv[index + 1]);
  const feed = options.get('--feed');
  const baseCommit = options.get('--base-commit');
  if (!feed || !baseCommit) throw new Error('usage: publish-update-feed.mjs --feed FILE --base-commit SHA');
  const api = githubApi({ repository: process.env.GITHUB_REPOSITORY ?? '', token: process.env.GITHUB_TOKEN ?? '' });
  const result = await publishFeed({
    api,
    xml: fs.readFileSync(feed, 'utf8'),
    baseCommit,
    expectedRef: options.get('--expected-ref'),
  });
  console.log(JSON.stringify(result));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
