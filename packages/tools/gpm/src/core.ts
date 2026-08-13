import * as path from 'node:path';

export interface Config {
  readonly root: readonly [string];
}

export interface Repository {
  readonly host: string;
  readonly pathSegments: readonly string[];
}

export class GpmError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'GpmError';
    this.exitCode = exitCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseConfig(source: string, configPath: string): Config {
  let value: unknown;

  try {
    value = JSON.parse(source) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GpmError(`invalid config ${configPath}: ${message}`);
  }

  if (!isRecord(value) || !Array.isArray(value.root)) {
    throw new GpmError(`invalid config ${configPath}: "root" must be an array containing exactly one path`);
  }

  if (value.root.length !== 1) {
    throw new GpmError(`invalid config ${configPath}: "root" must contain exactly one path`);
  }

  const root = value.root[0];
  if (typeof root !== 'string' || root.trim() === '' || !path.isAbsolute(root)) {
    throw new GpmError(`invalid config ${configPath}: "root" must contain one non-empty absolute path`);
  }

  return { root: [path.resolve(root)] };
}

function normalizeRepository(hostValue: string, pathname: string): Repository {
  const host = hostValue.trim().toLowerCase();
  if (host === '' || host.includes('/') || host.includes('\\')) {
    throw new GpmError('repository URL must include a valid host', 2);
  }

  const rawSegments = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (rawSegments.length < 2 || rawSegments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new GpmError('repository URL must include a safe owner and repository path', 2);
  }

  const pathSegments = rawSegments.map((segment) => decodeURIComponent(segment));
  if (
    pathSegments.some(
      (segment) =>
        segment === '' || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\'),
    )
  ) {
    throw new GpmError('repository URL contains an unsafe path segment', 2);
  }

  const lastIndex = pathSegments.length - 1;
  const repositoryName = pathSegments[lastIndex];
  if (repositoryName === undefined) {
    throw new GpmError('repository URL must include a repository name', 2);
  }
  if (repositoryName.endsWith('.git')) {
    pathSegments[lastIndex] = repositoryName.slice(0, -4);
  }

  if (pathSegments[lastIndex] === '') {
    throw new GpmError('repository URL must include a repository name', 2);
  }

  return { host, pathSegments };
}

export function parseRepository(repositoryUrl: string): Repository {
  const input = repositoryUrl.trim();
  if (input === '') {
    throw new GpmError('repository URL is required', 2);
  }

  const scpMatch = /^([^@/:\s]+)@([^:/\s]+):(.+)$/.exec(input);
  if (scpMatch) {
    const host = scpMatch[2];
    const pathname = scpMatch[3];
    if (host !== undefined && pathname !== undefined) {
      return normalizeRepository(host, pathname);
    }
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new GpmError('unsupported repository URL', 2);
  }

  if (!['http:', 'https:', 'git:', 'ssh:'].includes(url.protocol)) {
    throw new GpmError(`unsupported repository URL protocol: ${url.protocol}`, 2);
  }

  return normalizeRepository(url.hostname, url.pathname);
}

export function getDestination(root: string, repository: Repository): string {
  const absoluteRoot = path.resolve(root);
  const destination = path.resolve(absoluteRoot, repository.host, ...repository.pathSegments);
  const relative = path.relative(absoluteRoot, destination);

  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new GpmError('repository destination escapes the configured root', 2);
  }

  return destination;
}
