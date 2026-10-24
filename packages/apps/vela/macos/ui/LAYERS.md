# Vela macOS UI layers — contract for feature authors

Read this before writing a feature. It is the rule set the structure tests enforce.

## Layers (dependencies only point down)

```text
macos/ui/App.tsx        shell: navigation rail, pane routing, menu, keymap, modal mounting
macos/ui/features/*     product views: compose atoms, read/write `store`
macos/ui/ui/*           atoms: no product vocabulary, no Core, no store
macos/ui/core/          client.ts (Core RPC) + store.ts (state + flows). No JSX.
shared/ui/              pure projections, protocol types and the shared client factory
```

- Atoms (`macos/ui/ui/*`) MUST NOT import `../core`, `../features`, `shared/ui` or `../../../../shared/ui`.
- Features MUST NOT import `vela/native` / `CoreBridge`, call `JSON.parse`, or write hex colors, `dark:` variants, `p-*`/`px-*`/`py-*`/`m-*`/`gap-*` padding/spacing literals, or `min-h-[…]` row heights. Spacing comes from `spacing.*`, text from `type.*` + `text.*`, color from tokens via atoms.
- Values derived from props or signals MUST be getters (`const x = () => …`) — NSH re-runs bindings, not component bodies.
- `App.tsx` MUST NOT call `CoreBridge`.
- Platform code must never import `ios/**`; shared code must never import `macos/**` (`tests/structure.test.mjs`).

## Atoms you compose (import from "../../ui")

- `Page testID` + `PageHeader title description? back? actions?` — every pane.
- `CardSection title description? action? footer?` → wraps `Card` → contains a `List` of `ListRow`s, or `CardContent`.
- `ListRow title description?(string|string[]) mono? badge? leading? trailing? onPress? selected? disabled?` — the ONLY data row. `onPress` = whole row navigates (chevron shown). Never put destructive actions in a row.
- `List count? empty?` + `ListEmpty title description? action?`.
- `Badge status children` — the one status signal (no dot next to it).
- `Switch value onChange label` — persistent booleans. Row `description` says what it does, never "已开启/已关闭".
- `Button title variant(primary|outline|secondary|danger|plain) disabled? symbol? iconOnly?` — one-shot actions.
- `Alert tone(info|success|warning|danger) title? description? action?` — conditions needing attention.
- `Callout children tone?` — one-line guidance. No bare long `Text` paragraphs.
- `RadioGroup label value options onChange`, `TextField`, `Field`, `FormSheet title description? actions`.
- `LinkTrack phase`, `LogList lines`.

## Store (import { store } from "../../core/store")

State signals: `pane selected status network services devices logs activity forwards logLevel authPending authError` and form groups `addDevice rename editor dsh` (each field is a signal).
Derived: `needsAuth() selectedDevice() forwardFor(device, serviceId) tailnetCandidates()`.
Flows: `navigate.{devices,forwards,logs,account,settings,select(id),back,moveSelection}`,
`account.{signIn,check,reconnect,logout,beginRename,saveRename}`,
`sharing.{setEnabled(bool),setServiceShared(service,bool)}`,
`serviceEditor.{begin(service?),applyPreset(value),save,remove(service)}`,
`remotes.{beginAdd,choose(name),moveChoice,submit,remove(device),retry}`,
`forwarding.{request(device,serviceId),startDSH(withURL),start,open(forward),copy(text),stop(forward)}`,
`preferences.{current(),update(patch)}`, `refreshDiagnostics()`.

## Projections (import from "../../../shared/ui/<domain>.ts")

`services.ts`: `protocolOf targetLabel targetKey presetOptions presetFor presetForService serviceFormError serviceTargetURL serviceStateLabel dshAuthLogHint`.
`forwarding.ts`: `forwardEndpoint connectionCommand shareWarning`.
`devices.ts`: `localServices remoteDevices nextDeviceID deviceAddressLines connectionLabel isRecentService serviceKindLabel serviceBadge groupServicesByDevice`.
`diagnostics.ts`: `diagnosticSnapshot diagnosticSummaryRows diagnosticActivityRows appearancePreference remoteAddError`.
`logs.ts`: `logRows logLevelCounts`.

Tests: `macos/ui/tests/` (this app) and `shared/ui/` (projections, after S2). Run everything with `pnpm -F vela verify`.
