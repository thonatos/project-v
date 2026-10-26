import { expect, open, test } from 'nsh/test';

test('Vela bottom menu closes through platform back', async () => {
  const app = await open('../SemanticsFixture.tsx', { platform: 'ios', clock: {} });
  await app.press('Open menu');
  await app.waitFor('Inspect device');
  await app.back();
  await app.waitFor('Inspect device', { state: 'gone' });
  expect(app.shows('Open menu')).toBe(true);
});
