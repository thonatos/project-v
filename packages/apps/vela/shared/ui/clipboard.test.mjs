import assert from 'node:assert/strict';
import { copyTextWith } from './clipboard-port.ts';

{
  let value = '';
  const port = {
    writeText: async (next) => {
      value = next;
    },
    readText: async () => value,
  };
  assert.equal(await copyTextWith(port, 'diagnostic'), true);
}

{
  const denied = { writeText: async () => {}, readText: async () => '' };
  assert.equal(await copyTextWith(denied, 'diagnostic'), false, 'a denied no-op must be reported');
}

console.log('Vela clipboard writes report capability refusal');
