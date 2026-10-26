import { expect, open, test } from 'nsh/test';

test('Vela bottom menu selects and closes through nsh/base', async () => {
  const app = await open('../SemanticsFixture.tsx', { platform: 'ios', clock: {} });
  await app.press('Open menu');
  await app.waitFor('Inspect device');
  expect(app.enabled('Unavailable action')).toBe(false);
  await app.press('Inspect device');
  await app.waitFor('result inspect');
  await app.waitFor('Inspect device', { state: 'gone' });
});

test('Vela bottom menu follows back dismissal and runtime appearance', async () => {
  const app = await open('../SemanticsFixture.tsx', { platform: 'ios', colorScheme: 'light', reducedMotion: true, clock: {} });
  expect(app.texts()).toContain('reduced motion true');
  expect(app.texts().some((text) => /^font scale \d+\.\d{2}$/.test(text))).toBe(true);
  const light = app.texts().find((text) => text.startsWith('theme '));
  await app.setColorScheme('dark');
  await app.waitUntil(() => app.texts().some((text) => text.startsWith('theme ') && text !== light));
  await app.press('Open menu');
  await app.press('取消');
  await app.waitFor('Inspect device', { state: 'gone' });
});
