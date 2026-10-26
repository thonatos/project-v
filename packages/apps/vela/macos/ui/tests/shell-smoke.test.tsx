import { expect, open, test } from 'nsh/test';

// This uses NSH's generic development host. It verifies shell navigation and
// content reachability only; Vela's custom NSButton/NSSwitch and product visual
// appearance require the formal Vela host acceptance run.
test('settings and the add-device flow are reachable', async () => {
  const app = await open('../App.tsx', { platform: 'macos', reducedMotion: true, width: 480, height: 960 });
  await app.keyboard.press('mod+,');
  await app.waitFor('settings-view');
  expect(app.shows('跟随系统')).toBe(true);

  await app.keyboard.press('mod+n');
  await app.waitFor('Tailnet 设备');
  expect(app.shows('或输入私人名称')).toBe(true);
});
