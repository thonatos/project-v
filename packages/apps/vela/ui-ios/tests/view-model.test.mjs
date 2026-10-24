import assert from "node:assert/strict";
import {
  groupServicesByDevice,
  serviceBadge,
  serviceKindLabel,
  signedIn,
  userInitial,
  userLabel,
} from "../../ui-shared/view-model.mjs";

const status = (overrides = {}) => ({
  network: "connected",
  deviceName: "iPhone",
  tailscale: { name: "iPhone", user: "thonatos@example.com", ips: ["100.64.0.2"], tailnet: "example.ts.net" },
  tailnetDevices: [],
  remotes: [],
  ...overrides,
});

assert.equal(signedIn(status()), true);
assert.equal(signedIn(status({ network: "needs-auth" })), false);
assert.equal(signedIn(null), false);
assert.equal(userLabel(status()), "thonatos@example.com");
assert.equal(userInitial(status()), "T");
assert.equal(userInitial(null), "?");

const device = (overrides = {}) => ({
  id: "vela-macmini.example.ts.net",
  name: "vela-macmini",
  privateName: "vela-macmini.example.ts.net",
  ips: [],
  connection: "connected",
  lastConnected: "今天",
  compatible: true,
  services: [],
  ...overrides,
});
const service = (overrides = {}) => ({
  id: "opencode",
  name: "opencode",
  protocol: "http",
  state: "available",
  shared: true,
  subtitle: "Web 服务",
  ...overrides,
});

assert.deepEqual(serviceBadge(device(), service()), { status: "available", label: "可用", disabled: false });
assert.equal(serviceBadge(device(), service({ protocol: "tcp" })).disabled, true);
assert.equal(serviceBadge(device({ connection: "offline" }), service()).label, "离线");
assert.equal(serviceKindLabel(service({ adapter: "dsh" })), "DSH Web");
assert.equal(serviceKindLabel(service(), true), "Web 服务 · 最近访问");
assert.equal(serviceKindLabel(service({ protocol: "tcp" })), "TCP 服务 · 没有 iOS 入口");

const groups = groupServicesByDevice([
  device({ id: "b", name: "b", privateName: "b", connection: "offline", services: [service({ id: "dsh", name: "DSH" })] }),
  device({ id: "a", name: "a", privateName: "a", connection: "connected", services: [service({ id: "z", name: "Zed" }), service({ id: "a", name: "Alpha" })] }),
], { device: "a", service: "z" });
assert.equal(groups[0].device.name, "a");
assert.deepEqual(groups[0].services.map((item) => item.name), ["Zed", "Alpha"]);

console.log("Vela iOS shared projections passed");
