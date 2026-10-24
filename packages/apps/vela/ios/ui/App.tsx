/**
 * Vela for iPhone: a light browser for the services your Macs share.
 *
 *   Shell ── tabs: 服务 · 设备 · 日志 · 设置 · 我的 (floating tab bar)
 *        └── browser: one service, full screen, Safari-style toolbar
 *   Page sheets: rename · device · add
 *
 * The Rust host owns the window, lifecycle and native controls.
 */
import { effect, mount, View } from 'nsh';
import { setColorScheme } from 'nsh/device';
import { store } from './core/store';
import { RenameSheet } from './features/account/MePage';
import { AddDeviceSheet, DeviceSheet } from './features/devices/DeviceSheets';
import { Shell } from './features/shell/Shell';

function App() {
  store.start();
  effect(() => setColorScheme(store.preferences.current().appearance));
  return (
    <View class="flex-1">
      <Shell />
      <DeviceSheet />
      <AddDeviceSheet />
      <RenameSheet />
    </View>
  );
}

mount(App);
