# @implementsio/dsh-telegram

Telegram Bot private-chat plugin for DeepSeek Harness.

Version `1.0.0-dsh.0.2.0-rc.2` targets dsh `0.2.0-rc.2` and pins `node-telegram-bot-api` `2.1.0` (Bot API 10.3). It does not support the previous dsh `0.1.5-rc.1` settings and Agent lifecycle contracts; upgrade or roll back dsh and this plugin together.

Direct `@deepseek-ai/dsh-*` dependencies are pinned to the exact dsh core version rather than a range. The plugin imports `installModelSelection`, the storage-domain API, and the dsh Client configuration contracts; bump them with dsh so Cordis, Agent, storage, and Client services resolve as one graph.

## Version Mapping

The package version keeps an independent, monotonically increasing plugin core and encodes the exact compatible dsh release in its prerelease suffix:

```text
dsh-telegram <plugin-core>-dsh.<dsh-version>
1.0.0-dsh.0.2.0-rc.2 -> dsh 0.2.0-rc.2
```

Plugin-only fixes increment the plugin core while retaining the dsh suffix. For example, the next fix for the same host is `1.0.1-dsh.0.2.0-rc.2`. When the target dsh version changes, increment the plugin core again and replace the suffix; never reset or decrement the plugin core. The machine-readable source of truth remains the exact `engines.dsh` value, and direct dsh package dependencies MUST stay pinned to that same version.

Session bindings stay in the `telegram_bindings` domain at version `1`. The provider, model, and reasoning-effort fields are optional, so records written before they existed still validate, and older code reading a newer record drops the extra keys. Do not bump that version to add an optional field: the domain uses the default `single` layout, whose backend rejects any version stamp mismatch outright, and `compatibleVersions` applies only to `per-record` layout.

New Sessions record the resolved Agent preset in durable metadata. A resumed Session mounts the preset from its current projection rather than today's default. A legacy Session without preset data falls back to the current default; a Session whose stored preset no longer exists is not mounted under an unverified replacement and its stale Telegram binding is rebuilt with the current default.

## Local Acceptance (No Publish)

Acceptance must use the current workspace build. Do not run `npm publish`, `pnpm publish`, or install the candidate from a registry. Stop any existing web-profile process, record the profile's dependency state, then run:

```bash
pnpm -F @implementsio/dsh-telegram test
pnpm -F @implementsio/dsh-telegram build
dsh plugin --profile web link /absolute/path/to/packages/plugins/dsh-telegram
dsh --profile web --dump-config
```

The package declares `dsh.bundle.patch` in `package.json`, so an installed plugin is registered automatically from `cordis.patch.yml`. Do not pass that patch again on the command line:

```bash
# Wrong after installing the plugin: registers id "dsh-telegram" twice.
dsh --profile web --patch ./packages/plugins/dsh-telegram/cordis.patch.yml
```

Use an explicit local patch only for isolated development when the plugin is not installed in the target profile and the package is otherwise resolvable by dsh:

```bash
dsh --profile web --patch ./packages/plugins/dsh-telegram/cordis.patch.yml
```

The linked-profile and explicit-patch modes are mutually exclusive. Before startup, count the dump entries and require exactly one `id: dsh-telegram`; the target dsh release does not reject duplicate row ids by itself. If the count is not one, stop acceptance and remove the explicit `--patch` argument before starting Web.

The configuration UI is on the package's `dsh-telegram` row in Plugin Manager. Non-sensitive fields are stored in Loader Settings; the Bot Token is written only through Harness credentials. Configure the Token, Owner user ID, Workspace, and optional proxy there.

The target dsh release cannot bind an explicit LAN IP: its CLI rejects `0.0.0.0` while the webserver schema accepts only loopback or all interfaces. For an explicitly approved, short-lived LAN acceptance window, create a temporary Loader overlay outside the profile and repository that overrides the existing `webserver` row to `host: 0.0.0.0`, then start with the LAN authority:

```bash
dsh --profile web --patch <temporary-overlay.yml> --port 3080 --trusted-host <lan-ip>:3080 --no-open
```

This bypasses the CLI safety check and exposes an Agent/tool-capable Web service on every IPv4 interface. Use the tokenized URL only on a trusted network, never configure public/router forwarding, and stop the process immediately after acceptance. Delete the temporary overlay, then remove only this link and verify the profile returned to its recorded state:

```bash
dsh plugin --profile web unlink @implementsio/dsh-telegram
```

## Published Installation

After a separately approved release, install the published package into the target profile and start dsh normally:

```bash
dsh plugin --profile web add @implementsio/dsh-telegram
dsh web
```

## Telegram Commands

On startup, the plugin clears and registers these commands for Telegram's direct-message, group-chat, and group-administrator scopes. Runtime message handling remains restricted to the configured Owner private chat:

- `/new`: create a new Session in the current Workspace
- `/stop`: stop the current Agent turn
- `/help`: show supported commands
- `/model`: list available models, or switch to one
- `/status`: show the current Workspace, Session, model, and task status
- `/workspace`: choose a registered Workspace with inline buttons

Commands are defined in one place (`COMMAND_DEFINITIONS` in `src/transport/client.js`) and sorted by name length, so the Telegram menu, `/help`, and the unsupported-command hint all derive from that single source in the same order. Add a command there and the three surfaces update together.

Switching Workspace creates a new Session in that Workspace and persists the chat binding. The configured `workspaceId` remains the default when the chat has no valid binding. Unknown, unregistered, or unavailable Workspaces are rejected without changing the existing binding.

## Model Selection

`/model` has two forms:

```
/model                              list every routable provider and its models
/model <provider> <model>           switch to that route
```

The listing groups models under their provider and renders each one as a complete `/model <provider> <model>` command inside a `<code>` entity, which Telegram copies in full on a single tap — so a model is selected by copying one line and sending it, with no manual assembly. The currently active route is marked. A catalog's length is unbounded (an aggregator provider can advertise hundreds of models), so the listing is chunked line by line rather than by character: every `<code>` stays whole within one message instead of being split mid-tag. A provider whose catalog lookup fails is annotated in place; the remaining providers still list.

A switch validates the route through `ctx.llm.resolveModelInfo`, not through catalog membership: dsh defines the model catalog as advisory and it never controls request routing, so a model missing from the listing may still be routable and is accepted.

An accepted switch does two things. The live Session's Agent-level selection is updated, so the next step uses the new model while the existing conversation history is preserved and no new Session is created. The selection is also persisted on the chat binding, so it survives `/new`, a Workspace switch, a Session resume, and a Runtime restart. A chat without its own selection falls back to the complete `ctx.agentDefaultModel.currentSelection()` snapshot, including optional reasoning effort. A chat-level selection is never written to the dsh global default, so the Web UI and other Sessions are unaffected. If a persisted selection is no longer routable, the plugin falls back to the global default and says so once rather than degrading silently.

Reasoning effort is inherited and persisted when supplied by the binding or global default, but is not directly selectable by the Telegram command. `/model <provider> <model>` clears a prior effort so the newly selected model uses its own provider/model default.

Configured proxies are fixed per plugin rather than inherited from process proxy environment variables. SOCKS5 uses proxy-side DNS resolution (`socks5h`) so Telegram hostnames are resolved through the proxy; HTTP and HTTPS proxy configurations use an HTTPS tunneling agent.

## Rollback

Disable Telegram and stop `dsh web` before rollback so two pollers never consume the same Bot. Restore dsh `0.1.5-rc.1` and plugin `0.4.x` together. Credentials and `telegram_bindings` remain in place; the old schema ignores the optional reasoning-effort field. Do not mix dsh `0.2.0-rc.2` with the old plugin or the new plugin with the old dsh.
