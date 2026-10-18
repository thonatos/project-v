import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const link = `dsh plugin --profile web link ${JSON.stringify(packageRoot)}`;
const commands = [
  'pnpm -F @implementsio/dsh-telegram test',
  'pnpm -F @implementsio/dsh-telegram build',
  link,
  'dsh --profile web --dump-config',
  'dsh --profile web --patch <temporary-overlay.yml> --port 3080 --trusted-host <lan-ip>:3080 --no-open',
  'dsh plugin --profile web unlink @implementsio/dsh-telegram',
];
const forbidden = [/\b(?:npm|pnpm)\s+publish\b/u, /\bdsh\s+plugin\s+--profile\s+web\s+add\b/u];

for (const command of commands) {
  if (forbidden.some((pattern) => pattern.test(command))) {
    throw new Error(`Local acceptance plan contains a forbidden command: ${command}`);
  }
}

console.log(
  JSON.stringify(
    {
      mode: 'local-link-only',
      packageRoot,
      commands,
      preconditions: [
        'dsh --profile web --dump-config contains exactly one id: dsh-telegram row',
        'all-interface temporary overlay has explicit user approval and no public port forwarding',
      ],
      forbidden: ['npm publish', 'pnpm publish', 'dsh plugin --profile web add'],
    },
    null,
    2,
  ),
);
