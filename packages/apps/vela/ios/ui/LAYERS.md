# Vela iOS UI layers — contract for feature authors

Read this before writing a feature. It is the rule set `ios/ui/tests/structure.test.mjs` enforces.

## Layers (dependencies only point down)

```text
ios/ui/App.tsx          shell: mount, appearance effect, modal mounting
ios/ui/features/shell/  two layers: tabs (floating tab bar) and the browser stage
ios/ui/features/*       pages: services, devices, logs, settings, account
ios/ui/ui/*             atoms at 44pt touch density: cells, bars, sheets, status marks
ios/ui/core/            client.ts (Core RPC) + store.ts (stage machine, tabs, modals). No JSX.
ios/ui/types/vela/      native.d.ts for the Rust bridge
shared/ui/              pure projections, protocol types and the shared client factory
```

- Atoms (`ios/ui/ui/*`) MUST NOT import `core/`, `features/`, `vela/native` or shared projections.
- Features MUST NOT import `vela/native` / `CoreBridge` or call `JSON.parse`; only `core/client.ts` sends requests.
- Colors come from `nsh.json.theme` runtime tokens; spacing/type roles and audited native geometry are named in `ios/ui/ui/tokens.ts`. Features never write raw values or `dark:` mirrors.
- Features MUST NOT write store signals. They read accessors and call `navigation/page/remotes/account/preferences/diagnosticsActions/logsView` commands.
- Values derived from props or signals MUST be getters — NSH re-runs bindings, not component bodies.
- Touching desktop density is not allowed here: macOS atoms (`macos/ui/ui`) are not imported. The two platforms never import each other (`tests/structure.test.mjs`).

## Shell and browser

- `Shell` keeps the browser mounted while hidden; returning to a service never reloads it.
- The tabs are 服务 · 设备 · 日志 · 我的 · 设置. Devices, logs and settings are tabs, not modals.
- The account page reads 身份头 → 私人连接 → 这台 iPhone → 开发签名 → 注销; the identity header shows the avatar and name only, and the status lives in 私人连接.
- The devices tab lists 其他设备 with the same row anatomy as macOS: icon tile, name, `状态 · N 个服务`, status dot; addresses stay in the device sheet.
- `stage` is one of `empty · connecting · ready · error`; `modals` is a stack (`rename`, `device`, `add`).
- A TCP service has no iOS entry: it renders as unavailable, never as an error.
- The page's `dataKey` is the device + service pair, so each WebView gets its own cookie store.

## Store (import { store } from "../../core/store")

Read-only state: `status devices stage browsing tab modals deviceID authPending authError rechecking signingExpiry addDevice rename diagnostics pageLoading pageError pageTitle toolbarCollapsed canGoBack canGoForward pageDark logLevel activity`.
Derived: `network protocolVersion needsAuth loading refreshing copied signedIn userName userInitial device rows deviceGroups currentService tailnetCandidates selectableTailnetNames lastVisited isRecent top isOpen connectionLabel`.
Flows: `navigation.* page.* remotes.* account.* preferences.* diagnosticsActions.*`.

## Projections (import from "../../../shared/ui/<domain>.ts")

`devices.ts`: `connectionLabel deviceAddressLines isRecentService serviceKindLabel serviceBadge groupServicesByDevice`.
`identity.ts`: `signedIn userLabel userInitial`.
`diagnostics.ts`: `diagnosticActivityRows`.
`logs.ts`: `logRows logLevelCounts`.
`version.ts`: `APP_VERSION` (the single application version; the 关于 section reads it).

`ios/ui/core/signing.ts`: `signingNotice(expiresAt, now?)` derives the development-signing copy from the embedded profile's real expiry.

`nsh.json` declares Clipboard plus the exact HTTPS GET used for the private Gravatar cache. The custom WebView, status bar and Core bridge are trusted host components; Rust restricts WebView sources to Core's exact loopback HTTP hosts. Tests include static guards and `nsh test ios/ui/tests/semantics.test.tsx`; run everything with `pnpm -F vela verify`.
