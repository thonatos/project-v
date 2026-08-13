import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readSync, writeFileSync, writeSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GpmError, getDestination, parseConfig, parseRepository } from './core.ts';

const VERSION = '0.1.0';

const HELP = `gpm - Git project manager

Usage:
  gpm <command>

Commands:
  init                  Create the default configuration
  clone <repository>    Clone a repository into the managed root
  help                  Show help
  version               Show version

Examples:
  gpm init
  gpm clone https://github.com/thonatos/project-v.git
  gpm clone git@github.com:thonatos/project-v.git

Config:
  ~/.gpmrc
  {"root":["/absolute/path/to/gpm"]}
`;

const CLONE_HELP = `Usage:
  gpm clone <repository-url>

Supported repository URLs:
  https://github.com/owner/repository.git
  http://github.com/owner/repository.git
  git://github.com/owner/repository.git
  ssh://git@github.com/owner/repository.git
  git@github.com:owner/repository.git

Destination:
  <root>/<host>/<repository-path>
`;

function stdout(message: string): void {
  writeSync(1, message);
}

function stderr(message: string): void {
  writeSync(2, message);
}

function getPaths(): { readonly configPath: string; readonly defaultRoot: string } {
  const home = os.homedir();
  if (home === '' || !path.isAbsolute(home)) {
    throw new GpmError('could not determine an absolute user home directory');
  }

  return {
    configPath: path.join(home, '.gpmrc'),
    defaultRoot: path.join(home, 'gpm'),
  };
}

function initialize(): { readonly configPath: string; readonly root: string } {
  const { configPath, defaultRoot } = getPaths();
  if (existsSync(configPath)) {
    throw new GpmError(`config already exists: ${configPath}`);
  }

  mkdirSync(defaultRoot, { recursive: true });
  writeFileSync(configPath, `${JSON.stringify({ root: [defaultRoot] })}\n`, { encoding: 'utf8' });
  stderr(`Config: ${configPath}\nRoot:   ${defaultRoot}\nInitialized successfully.\n`);
  return { configPath, root: defaultRoot };
}

function confirmDefaultConfig(configPath: string, defaultRoot: string): boolean {
  stderr(`Config file not found: ${configPath}\nCreate it with root "${defaultRoot}"? [Y/n] `);
  const buffer = Buffer.alloc(1);
  let answer = '';

  while (true) {
    const count = readSync(0, buffer, 0, 1, null);
    if (count === 0 || buffer[0] === 10 || buffer[0] === 13) {
      break;
    }
    answer += buffer.toString('utf8', 0, count);
  }

  const normalized = answer.trim().toLowerCase();
  return normalized === '' || normalized === 'y' || normalized === 'yes';
}

function loadConfigForClone(): { readonly configPath: string; readonly root: string } {
  const { configPath, defaultRoot } = getPaths();
  if (!existsSync(configPath)) {
    if (process.stdin.isTTY !== true) {
      throw new GpmError(
        `config not found: ${configPath}\nrun "gpm init" first\nexpected format: {"root":["/absolute/path/to/gpm"]}`,
      );
    }

    if (!confirmDefaultConfig(configPath, defaultRoot)) {
      throw new GpmError('configuration was not created');
    }

    return initialize();
  }

  const config = parseConfig(readFileSync(configPath, 'utf8'), configPath);
  return { configPath, root: config.root[0] };
}

async function clone(repositoryUrl: string): Promise<number> {
  const repository = parseRepository(repositoryUrl);
  const { configPath, root } = loadConfigForClone();
  const destination = getDestination(root, repository);

  if (existsSync(destination)) {
    throw new GpmError(`destination already exists: ${destination}`);
  }

  mkdirSync(path.dirname(destination), { recursive: true });
  stderr(
    `Config:      ${configPath}\nRepository:  ${repositoryUrl}\nDestination: ${destination}\nCloning repository...\n`,
  );

  const result = spawnSync('git', ['clone', repositoryUrl, destination], {
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.stdout) {
    writeSync(2, result.stdout);
  }
  if (result.stderr) {
    writeSync(2, result.stderr);
  }

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      throw new GpmError('git executable was not found in PATH', 127);
    }
    throw new GpmError(`failed to start git: ${error.message}`);
  }

  if (result.status !== 0) {
    const exitCode = result.status === null ? 1 : result.status;
    throw new GpmError(`git clone failed with exit code ${exitCode}`, exitCode);
  }

  stderr('Clone completed.\n');
  stdout(`${destination}\n`);
  return 0;
}

async function run(args: readonly string[]): Promise<number> {
  if (args.length === 0 || args[0] === 'help' || args[0] === '-h' || args[0] === '--help') {
    if (args.length > 1 && args[1] === 'clone') {
      stdout(CLONE_HELP);
    } else {
      stdout(HELP);
    }
    return 0;
  }

  const command = args[0];
  if (command === 'version' || command === '-v' || command === '--version') {
    stdout(`gpm ${VERSION}\n`);
    return 0;
  }

  if (command === 'init') {
    initialize();
    return 0;
  }

  if (command === 'clone') {
    if (args.length > 1 && (args[1] === '-h' || args[1] === '--help')) {
      stdout(CLONE_HELP);
      return 0;
    }
    if (args.length < 2) {
      throw new GpmError('repository URL is required\nusage: gpm clone <repository-url>', 2);
    }
    const repositoryUrl = args[1];
    if (repositoryUrl === undefined) {
      throw new GpmError('repository URL is required\nusage: gpm clone <repository-url>', 2);
    }
    return clone(repositoryUrl);
  }

  throw new GpmError(`unknown command: ${command}\nusage: gpm <init|clone|help|version>`, 2);
}

async function main(): Promise<void> {
  try {
    const code = await run(process.argv.slice(2));
    if (code !== 0) {
      process.exit(code);
    }
  } catch (error) {
    if (error instanceof GpmError) {
      stderr(`error: ${error.message}\n`);
      process.exit(error.exitCode);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      stderr(`error: ${message}\n`);
      process.exit(1);
    }
  }
}

void main();
