import { expect, open, test } from 'nsh/test';

test('Vela controls expose native roles and controlled state', async () => {
  const app = await open('../SemanticsFixture.tsx', { platform: 'macos', clock: {} });
  expect(app.count('role:tab')).toBe(2);
  expect(app.count('role:radio')).toBe(2);
  await app.press('Two');
  await app.waitFor('selected two');
  await app.press('Team');
  await app.waitFor('plan team');
  await app.press('Open device，在线，2 个服务');
  await expect(() => app.press('Unavailable')).rejects.toThrow('is disabled');
});

test('base Menu owns selection and dismissal', async () => {
  const app = await open('../SemanticsFixture.tsx', { clock: {} });
  await app.press('Open commands');
  await app.waitFor('Run command');
  await app.press('Run command');
  await app.waitFor('selected two');
  expect(app.shows('Run command')).toBe(false);
});

test('computed caches repeated reads and owned timers clean up', async () => {
  const app = await open('../SemanticsFixture.tsx', { clock: {} });
  await app.waitFor('derived 2');
  await app.press('Increment');
  await app.waitFor('derived 4');
  await app.press('Report runs');
  await app.waitFor('computed runs 2');
  await app.press('Hide timer');
  await app.clock.fastForward(200);
  expect(app.texts()).toContain('timer calls 0');
});

test('runtime theme follows appearance and layout survives a wider viewport', async () => {
  const app = await open('../SemanticsFixture.tsx', {
    colorScheme: 'light',
    reducedMotion: true,
    width: 480,
    height: 960,
  });
  expect(app.texts()).toContain('reduced motion true');
  expect(app.texts().some((text) => /^font scale \d+\.\d{2}$/.test(text))).toBe(true);
  const light = app.texts().find((text) => text.startsWith('theme '));
  await app.setColorScheme(light?.includes('#a8491f') ? 'dark' : 'light');
  await app.waitUntil(() => app.texts().some((text) => text.startsWith('theme ') && text !== light));
  await app.setViewport(960, 480);
  expect(app.shows('Open device，在线，2 个服务')).toBe(true);
});
