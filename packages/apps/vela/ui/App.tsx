/**
 * Vela's shell: the navigation rail, pane routing, the application menu and
 * shortcuts, and the dialogs. Pages live in `features/`; state and Core flows
 * live in `core/store.ts`.
 */
import { effect, mount, View } from "nsh";
import { Menu, Window } from "nsh/desktop";
import { keymap } from "nsh/keymap";
import { store, type Pane } from "./core/store";
import { AccountPage } from "./features/account/AccountPage";
import { DevicesPage } from "./features/devices/DevicesPage";
import { AddDeviceSheet, RenameDeviceSheet } from "./features/devices/sheets";
import { ForwardsPage } from "./features/forwards/ForwardsPage";
import { LogsPage } from "./features/logs/LogsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ServiceEditorSheet } from "./features/services/ServiceEditorSheet";
import { Button, edges, surfaces } from "./ui";

const RAIL: readonly { pane: Pane; title: string; symbol: string; go: () => void; bottom?: boolean }[] = [
  { pane: "devices", title: "设备", symbol: "desktopcomputer", go: store.navigate.devices },
  { pane: "forwards", title: "转发", symbol: "arrow.left.arrow.right", go: store.navigate.forwards },
  { pane: "logs", title: "日志", symbol: "list.bullet.rectangle", go: store.navigate.logs, bottom: true },
  { pane: "account", title: "账户", symbol: "person.crop.circle", go: store.navigate.account, bottom: true },
  { pane: "settings", title: "设置", symbol: "gearshape", go: store.navigate.settings, bottom: true },
];

function RailButton(props: { item: (typeof RAIL)[number] }) {
  return <Button title={props.item.title} symbol={props.item.symbol} iconOnly variant={store.pane() === props.item.pane ? "outline" : "plain"} onPress={props.item.go} />;
}

function App() {
  Window.setTitleBar("default");
  store.start();

  effect(() => {
    Menu.setApplicationMenu([
      { label: "Vela", submenu: [{ role: "about" }, { label: "设置…", shortcut: "mod+,", onSelect: store.navigate.settings }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { type: "separator" }, { role: "quit" }] },
      { label: "文件", submenu: [{ label: "添加设备…", shortcut: "mod+n", onSelect: store.remotes.beginAdd }, { role: "close" }] },
      { label: "编辑", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
      { label: "显示", submenu: [
        { label: "设备", shortcut: "mod+1", onSelect: store.navigate.devices },
        { label: "转发", shortcut: "mod+2", onSelect: store.navigate.forwards },
        { label: "日志", shortcut: "mod+3", onSelect: store.navigate.logs },
        { label: "账户", shortcut: "mod+4", onSelect: store.navigate.account },
        { label: "设置", shortcut: "mod+,", onSelect: store.navigate.settings },
        { label: "刷新", shortcut: "mod+r", onSelect: () => void store.load(true) },
      ] },
      { label: "窗口", submenu: [{ role: "minimize" }] },
    ]);
  });
  keymap.bind("mod+,", store.navigate.settings, { when: "always" });
  keymap.bind({
    "mod+n": store.remotes.beginAdd,
    "mod+1": store.navigate.devices,
    "mod+2": store.navigate.forwards,
    "mod+3": store.navigate.logs,
    "mod+4": store.navigate.account,
    "mod+r": () => void store.load(true),
    "mod+[": store.navigate.back,
    "escape": store.navigate.back,
  }, { when: "notEditing" });
  keymap.bind({
    "up": () => (store.addDevice.open() ? store.remotes.moveChoice(-1) : store.navigate.moveSelection(-1)),
    "down": () => (store.addDevice.open() ? store.remotes.moveChoice(1) : store.navigate.moveSelection(1)),
    "enter": () => { if (store.addDevice.open() && store.addDevice.selection()) store.remotes.submit(); },
  }, { when: "notEditing", repeat: true });

  return <View class={`flex-1 ${surfaces.surface}`}>
    <View class="flex-1 flex-row">
      <View class={`w-14 border-r ${edges.line} ${surfaces.sidebar}`}>
        <View class="flex-1 items-center gap-1 p-2">
          <Each of={RAIL.filter((item) => !item.bottom)}>{(item) => <RailButton item={item()} />}</Each>
          <View class="flex-1" />
          <Each of={RAIL.filter((item) => item.bottom)}>{(item) => <RailButton item={item()} />}</Each>
        </View>
      </View>
      <View class="flex-1">
        <If when={store.pane() === "devices"}><DevicesPage /></If>
        <If when={store.pane() === "forwards"}><ForwardsPage /></If>
        <If when={store.pane() === "logs"}><LogsPage /></If>
        <If when={store.pane() === "account"}><AccountPage /></If>
        <If when={store.pane() === "settings"}><SettingsPage /></If>
      </View>
    </View>
    <AddDeviceSheet />
    <RenameDeviceSheet />
    <ServiceEditorSheet />
  </View>;
}

mount(App);
