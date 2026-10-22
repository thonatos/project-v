/**
 * Pure projections from Core payloads to what the views render. Nothing here
 * touches NSH or Core, so every rule is covered by `tests/view-model.test.mjs`.
 */

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

export function protocolOf(service) {
  return service?.protocol === "tcp" ? "tcp" : "http";
}

/** `tcp://127.0.0.1:6379` reads as `127.0.0.1:6379`; HTTP targets stay as URLs. */
export function targetLabel(protocol, url) {
  if (protocol !== "tcp") return url ?? "";
  return String(url ?? "").replace(/^tcp:\/\//, "");
}

export function localServices(status) {
  return status.services.map((service) => {
    const protocol = protocolOf(service);
    return {
      id: service.id,
      name: service.name,
      subtitle: targetLabel(protocol, service.url),
      protocol,
      preset: service.preset,
      state: service.state,
      shared: service.shared,
      url: service.url,
      port: service.port,
      adapter: service.adapter,
    };
  });
}

export function remoteDevices(remotes) {
  return remotes.map((remote) => ({
    id: remote.privateName,
    name: remote.name || remote.privateName,
    privateName: remote.privateName,
    ips: [...(remote.ips ?? [])],
    connection: remote.connection ?? "offline",
    lastConnected: remote.lastConnectedUtc ?? "从未连接",
    compatible: remote.compatible ?? true,
    issue: remote.issue,
    services: (remote.services ?? []).map((service) => {
      const protocol = protocolOf(service);
      return {
        id: service.id,
        name: service.name,
        subtitle: protocol === "tcp" ? "TCP 服务" : service.adapter === "dsh" ? "DSH Web" : "Web 服务",
        protocol,
        preset: service.preset,
        state: service.available ? "available" : "unavailable",
        shared: true,
        port: service.port,
        adapter: service.adapter,
      };
    }),
  }));
}

/**
 * Presets for the add-service form, grouped by protocol. `id` is the stable
 * service identifier Core keeps for OpenCode and DSH; other presets let Core
 * assign one, so the same preset can be added more than once.
 */
export const SERVICE_PRESETS = [
  { preset: "opencode", group: "web", label: "OpenCode", protocol: "http", id: "opencode", name: "OpenCode", url: "http://127.0.0.1:49374/api/info", adapter: "opencode", unique: true },
  { preset: "dsh", group: "web", label: "DSH", protocol: "http", id: "dsh", name: "DSH", url: "http://127.0.0.1:3080/", adapter: "dsh", unique: true },
  { preset: "comfyui", group: "web", label: "ComfyUI", protocol: "http", id: "", name: "ComfyUI", url: "http://127.0.0.1:8188/", adapter: "", unique: false },
  { preset: "custom-http", group: "web", label: "自定义 HTTP", protocol: "http", id: "", name: "", url: "http://127.0.0.1:", adapter: "", unique: false },
  { preset: "ssh", group: "tcp", label: "SSH", protocol: "tcp", id: "", name: "SSH", url: "tcp://127.0.0.1:22", adapter: "", unique: false },
  { preset: "redis", group: "tcp", label: "Redis", protocol: "tcp", id: "", name: "Redis", url: "tcp://127.0.0.1:6379", adapter: "", unique: false },
  { preset: "mysql", group: "tcp", label: "MySQL", protocol: "tcp", id: "", name: "MySQL", url: "tcp://127.0.0.1:3306", adapter: "", unique: false },
  { preset: "postgres", group: "tcp", label: "PostgreSQL", protocol: "tcp", id: "", name: "PostgreSQL", url: "tcp://127.0.0.1:5432", adapter: "", unique: false },
  { preset: "custom-tcp", group: "tcp", label: "自定义 TCP", protocol: "tcp", id: "", name: "", url: "tcp://127.0.0.1:", adapter: "", unique: false },
];

/** Options for one preset group, with a unique preset disabled once it exists. */
export function presetOptions(group, services) {
  return SERVICE_PRESETS.filter((preset) => preset.group === group).map((preset) => ({
    value: preset.preset,
    label: preset.label,
    detail: targetLabel(preset.protocol, preset.url.replace(/:$/, ":…")),
    disabled: preset.unique && services.some((service) => service.adapter === preset.adapter),
  }));
}

export function presetFor(value) {
  return SERVICE_PRESETS.find((preset) => preset.preset === value) ?? SERVICE_PRESETS.find((preset) => preset.preset === "custom-http");
}

/** The preset a stored service most likely came from, so editing shows its type. */
export function presetForService(service) {
  if (service?.preset && SERVICE_PRESETS.some((preset) => preset.preset === service.preset)) return service.preset;
  if (service?.adapter === "opencode") return "opencode";
  if (service?.adapter === "dsh") return "dsh";
  return protocolOf(service) === "tcp" ? "custom-tcp" : "custom-http";
}

/**
 * Validates the form before it reaches Core, so the message names the field the
 * user can fix. Core still validates authoritatively.
 */
export function serviceFormError(protocol, name, target) {
  if (!name.trim()) return "请输入服务名称。";
  const value = target.trim();
  if (protocol === "tcp") {
    const match = value.replace(/^tcp:\/\//, "").match(/^(localhost|127\.0\.0\.1|\[::1\]):(\d{1,5})$/);
    if (!match) return "请输入 loopback 地址与端口，例如 127.0.0.1:6379。";
    const port = Number(match[2]);
    if (port < 1 || port > 65535) return "端口必须在 1–65535 之间。";
    return "";
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "请输入完整的 loopback HTTP 地址，例如 http://127.0.0.1:3000/。";
  }
  if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.includes(parsed.hostname)) return "只接受 localhost、127.0.0.1 或 ::1 的 HTTP 地址。";
  return "";
}

/** Normalises the TCP field to the `tcp://host:port` form Core expects. */
export function serviceTargetURL(protocol, target) {
  const value = target.trim();
  if (protocol !== "tcp") return value;
  return value.startsWith("tcp://") ? value : `tcp://${value}`;
}

/**
 * Splits a forwarded address into what a client needs. TCP forwards have no
 * page to open, so they are shown as a host, a port and a ready command.
 */
export function forwardEndpoint(url) {
  try {
    const parsed = new URL(url);
    return { protocol: parsed.protocol === "tcp:" ? "tcp" : "http", host: parsed.hostname, port: Number(parsed.port) };
  } catch {
    return { protocol: "http", host: "", port: 0 };
  }
}

/**
 * A connection command for a TCP forward. MySQL gets `127.0.0.1` because its
 * client treats `localhost`-style names as a Unix socket; the others keep the
 * per-service host so `~/.ssh/config` entries stay stable.
 */
export function connectionCommand(preset, url) {
  const { protocol, host, port } = forwardEndpoint(url);
  if (protocol !== "tcp" || !host || !port) return "";
  if (preset === "ssh") return `ssh -p ${port} <user>@${host}`;
  if (preset === "mysql") return `mysql -h 127.0.0.1 -P ${port} -u <user> -p`;
  if (preset === "postgres") return `psql -h ${host} -p ${port} -U <user>`;
  if (preset === "redis") return `redis-cli -h ${host} -p ${port}`;
  return `${host}:${port}`;
}

/** First-share confirmation, which is stronger for a shell than for a page. */
export function shareWarning(service) {
  const name = service?.name ?? "该服务";
  if (protocolOf(service) === "tcp" && service?.preset === "ssh") {
    return {
      title: "共享命令行访问",
      message: `${name} 可获得这台 Mac 的命令行。远端设备仍需通过 SSH 自身的密钥或密码认证；请先在“系统设置 › 通用 › 共享”中开启“远程登录”。仅向你信任的私人设备共享。`,
    };
  }
  if (protocolOf(service) === "tcp") {
    return { title: "共享 TCP 服务", message: `${name} 会以原始 TCP 方式提供给你的其他设备，认证由该服务自身负责。仅向你信任的私人设备共享。` };
  }
  return { title: "共享开发控制权限", message: `${name} 可以运行命令并修改这台 Mac 上的文件。仅向你信任的私人设备共享。` };
}

export function diagnosticSnapshot(status, protocolVersion) {
  return JSON.stringify({
    version: protocolVersion,
    network: status.network,
    sharing: status.sharing,
    services: status.services.map(({ id, state, shared, protocol }) => ({ id, protocol: protocol ?? "http", state, shared })),
    remotes: status.remotes.map(({ connection, compatible, issue }) => ({ connection, compatible, issue })),
    redacted: true,
  });
}

const CONNECTION_LABELS = { connected: "在线", connecting: "连接中", offline: "离线", "needs-auth": "需要连接" };

export function connectionLabel(state) {
  return CONNECTION_LABELS[state] ?? "离线";
}

/**
 * Projects the redacted snapshot into readable rows, so the settings page can
 * show what would be copied instead of hiding it behind the copy action.
 */
export function diagnosticSummaryRows(status, protocolVersion) {
  if (!status) {
    return [{ key: "protocol", title: `协议 v${protocolVersion}`, detail: "等待 Core 响应" }];
  }
  const services = status.services ?? [];
  const remotes = status.remotes ?? [];
  const shared = services.filter((service) => service.shared).length;
  const reachable = remotes.filter((remote) => remote.connection === "connected").length;
  const incompatible = remotes.filter((remote) => remote.compatible === false).length;
  const unavailable = services.filter((service) => service.state !== "available").length;
  return [
    { key: "protocol", title: `协议 v${protocolVersion}`, detail: status.tailscale?.tailnet ? `tailnet ${status.tailscale.tailnet}` : "未连接 tailnet" },
    { key: "network", title: "私人连接", detail: connectionLabel(status.network) },
    {
      key: "sharing",
      title: "共享",
      detail: status.sharing?.enabled
        ? `已开启 · ${shared}/${services.length} 个服务已共享${unavailable > 0 ? ` · ${unavailable} 个不可用` : ""}`
        : "已关闭",
    },
    {
      key: "remotes",
      title: "其他设备",
      detail: remotes.length === 0
        ? "尚未添加"
        : `${reachable}/${remotes.length} 台在线${incompatible > 0 ? ` · ${incompatible} 台需要更新` : ""}`,
    },
  ];
}

export function nextDeviceID(selected, remoteIDs, direction) {
  const ids = ["this-mac", ...remoteIDs];
  const current = ids.indexOf(selected);
  const next = current < 0 ? 0 : (current + direction + ids.length) % ids.length;
  return ids[next];
}

export function remoteAddError(detail) {
  if (detail.includes("incompatible")) return "两台 Mac 的 Vela 版本不兼容。";
  if (detail.includes("authorized") || detail.includes("rejected")) return "另一台 Mac 拒绝了此设备。";
  if (detail.includes("invalid")) return "私人名称格式无效。";
  return "无法连接到这台 Mac。请确认它在线并运行 Vela。";
}

/** The label for a service's availability; sharing itself is a switch. */
export function serviceStateLabel(service) {
  if (service.state === "checking") return "检查中";
  if (service.state === "unavailable") return protocolOf(service) === "tcp" ? "未在监听" : "不可用";
  return "可用";
}

export function dshMappingURL(mappingURL, authenticationURL) {
  const auth = new URL(authenticationURL);
  if (auth.protocol !== "http:" || !LOOPBACK_HOSTS.includes(auth.hostname)) {
    throw new Error("DSH authentication URL must be a loopback HTTP URL");
  }
  const mapping = new URL(mappingURL);
  mapping.pathname = auth.pathname;
  mapping.search = auth.search;
  mapping.hash = auth.hash;
  return mapping.toString();
}

export function appearancePreference(status) {
  const appearance = status?.preferences?.appearance;
  return appearance === "light" || appearance === "dark" ? appearance : "system";
}

export function diagnosticActivityRows(activity) {
  return (activity?.mappings ?? []).map((mapping) => ({
    key: `${mapping.privateName}/${mapping.service}`,
    title: `${mapping.device} / ${mapping.service}`,
    detail: `${targetLabel(forwardEndpoint(mapping.url).protocol, mapping.url)} · ${mapping.connections} 个活跃连接`,
  }));
}

/** A device row's addresses: IPv4 first, each family on its own line. */
export function deviceAddressLines(ips) {
  const list = [...(ips ?? [])];
  const v4 = list.filter((ip) => !ip.includes(":"));
  const v6 = list.filter((ip) => ip.includes(":"));
  return [...v4, ...v6];
}

const LOG_LEVELS = { error: "ERROR", warn: "WARN", info: "INFO" };

/** Normalises a Core level, so an unknown value still renders as information. */
function logLevel(value) {
  const level = String(value ?? "").toLowerCase();
  if (level === "warning") return "warn";
  return level in LOG_LEVELS ? level : "info";
}

/**
 * Formats an RFC 3339 instant as a local wall clock, which is what a log is
 * scanned by. The raw UTC string is neither readable nor column-aligned.
 */
function logTime(atUtc) {
  const at = new Date(atUtc);
  if (Number.isNaN(at.getTime())) return "--:--:--";
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

/**
 * Projects journal entries newest-first into log rows: a time column, a level
 * and the message as the subject. Passing a level narrows the result.
 */
export function logRows(logs, level = "all") {
  return [...(logs?.entries ?? [])]
    .reverse()
    .map((entry, index) => {
      const normalized = logLevel(entry.level);
      return {
        key: `${entry.atUtc}-${index}`,
        time: logTime(entry.atUtc),
        level: normalized,
        levelLabel: LOG_LEVELS[normalized],
        area: entry.area ?? "",
        message: entry.message ?? "",
      };
    })
    .filter((row) => level === "all" || row.level === level);
}

/** Counts entries per level so the filter can show what it would reveal. */
export function logLevelCounts(logs) {
  const counts = { all: 0, error: 0, warn: 0, info: 0 };
  for (const entry of logs?.entries ?? []) {
    counts.all += 1;
    counts[logLevel(entry.level)] += 1;
  }
  return counts;
}
