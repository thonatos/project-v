/**
 * The shell. Two layers:
 *
 *   tabs      the page of the selected tab, with a floating tab bar
 *             [设备] [服务] [日志] [我的] [设置]
 *   browser   one service, full screen, Safari-style bottom toolbar
 *
 * The browser stays mounted while hidden, so returning to a service never
 * reloads it. "⋯" opens a full-width bottom menu.
 */
import { Text, View, signal } from "nsh";
import { BottomMenu, FloatingTabBar, Monogram, font, ink, inset, surface, type MenuItem, type TabItem } from "../../ui";
import { store, type Tab } from "../../core/store";
import { DevicesPage } from "../devices/DeviceSheets";
import { LogsPage } from "../logs/LogsPage";
import { BrowserPage, reloadPage } from "../services/BrowserPage";
import { ServicesPage } from "../services/ServicesPage";
import { SettingsPage } from "../settings/SettingsPage";
import { MePage } from "../account/MePage";

const menuOpen = signal(false);

const TABS: readonly TabItem<Tab>[] = [
  { id: "devices", label: "设备", symbol: "macbook", activeSymbol: "macbook" },
  { id: "services", label: "服务", symbol: "square.grid.2x2", activeSymbol: "square.grid.2x2.fill" },
  { id: "logs", label: "日志", symbol: "list.bullet.rectangle", activeSymbol: "list.bullet.rectangle.fill" },
  { id: "me", label: "我的", symbol: "person.crop.circle", activeSymbol: "person.crop.circle.fill" },
  { id: "settings", label: "设置", symbol: "gearshape", activeSymbol: "gearshape.fill" },
];

/** What the menu acts on: the open service. */
function MenuHeader() {
  const current = () => store.currentService();
  return <View class={`w-full flex-row items-center ${inset.row} ${inset.screen} ${inset.menuHeader}`}>
    <Monogram label={current()?.service.name ?? ""} colorKey={current()?.device.privateName ?? ""} />
    <View class={`min-w-0 flex-1 ${inset.tight}`}>
      <Text numberOfLines={1} class={`${font.bodyStrong} ${ink.primary}`}>{current()?.service.name ?? ""}</Text>
      <Text numberOfLines={1} class={`${font.detail} ${ink.secondary}`}>{store.pageTitle() || current()?.device.name || ""}</Text>
    </View>
  </View>;
}

/** The service page's menu: what can be done with the open service. */
function browserMenu(): MenuItem[][] {
  const device = () => store.currentService()?.device;
  return [[
    { label: "设备信息", symbol: "macbook", onSelect: () => { const value = device(); if (value) store.navigation.device(value.id); } },
    { label: "服务列表", symbol: "square.grid.2x2", onSelect: store.navigation.home },
    { label: "重新加载", symbol: "arrow.clockwise", onSelect: reloadPage, disabled: store.stage().phase !== "ready" },
    { label: "关闭服务", symbol: "xmark.circle", onSelect: store.navigation.closeService, destructive: true },
  ]];
}

export function Shell() {
  const browsing = () => store.browsing() && store.stage().phase !== "empty";
  return <View class={`flex-1 ${surface.canvas}`}>
    <View class={`min-h-0 flex-1 ${browsing() ? "hidden" : ""}`}>
      <If when={store.tab() === "services"}><ServicesPage /></If>
      <If when={store.tab() === "devices"}><DevicesPage /></If>
      <If when={store.tab() === "logs"}><LogsPage /></If>
      <If when={store.tab() === "settings"}><SettingsPage /></If>
      <If when={store.tab() === "me"}><MePage /></If>
      <FloatingTabBar items={TABS} selected={store.tab()} onSelect={store.navigation.select} />
    </View>

    <If when={store.stage().phase !== "empty"}>
      <View class={`absolute inset-0 ${browsing() ? "" : "hidden"}`}>
        <BrowserPage onMenu={() => menuOpen.set(true)} />
      </View>
    </If>

    <BottomMenu
      open={menuOpen()}
      onClose={() => menuOpen.set(false)}
      header={<MenuHeader />}
      groups={browserMenu()}
      testID="browser-menu"
    />
  </View>;
}
