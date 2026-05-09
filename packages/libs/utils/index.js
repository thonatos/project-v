import { createHonchoJwt } from './lib/honcho.js';

const adminToken = createHonchoJwt(process.env.HONCHO_AUTH_JWT_SECRET, {
  t: '',
  ad: true,
});
console.log('Generated Honcho JWT:', adminToken);

const claudeCodeToken = createHonchoJwt(process.env.HONCHO_AUTH_JWT_SECRET, {
  w: 'claude_code',
});
console.log('Generated Honcho JWT for claude_code:', claudeCodeToken);

const hermesAgentToken = createHonchoJwt(process.env.HONCHO_AUTH_JWT_SECRET, {
  w: 'hermes-agent',
});

console.log('Generated Honcho JWT for hermes-agent:', hermesAgentToken);
