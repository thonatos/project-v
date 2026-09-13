# @implementsio/dsh-telegram

Telegram Bot private-chat plugin for DeepSeek Harness.

Version `0.3.1` targets dsh `0.1.5-rc.1` and pins `node-telegram-bot-api` `2.1.0` (Bot API 10.3). The plugin continues to use standard text editing and media methods for streaming compatibility; the SDK's rich-message, ephemeral-message, disabled-button, and generation-stop additions are available for future transport features but do not change current message behavior.

`@deepseek-ai/dsh-agent` is pinned to the exact dsh core version (`0.1.5-rc.1`) rather than a range, because the plugin imports `installModelSelection` from it to switch a live Session's model. That version is an rc, so the symbol's signature may move; bump both together. It is the only symbol imported from that package, keeping the coupling surface minimal.

Session bindings stay in the `telegram_bindings` domain at version `1`. The two model-selection fields are optional, so records written before they existed still validate, and older code reading a newer record drops the extra keys — compatible in both directions without involving the version number. Do not bump that version to add a field: the domain uses the default `single` layout, whose backend rejects any version stamp mismatch outright, and `compatibleVersions` applies only to the `per-record` layout. Bumping it makes an existing deployment fail to start with `version-mismatch`.

## Install And Start

Install the plugin into the target profile, then start dsh normally:

```bash
dsh plugin --profile web add @implementsio/dsh-telegram
dsh web
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

The installed-profile and explicit-patch modes are mutually exclusive. Check the composed plugin tree with:

```bash
dsh --profile web --dump-config
```

The output must contain exactly one `id: dsh-telegram` entry. If startup reports `duplicate loader entry id: dsh-telegram`, remove the explicit `--patch` argument and start the installed plugin normally.

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

An accepted switch does two things. The live Session's Agent-level selection is updated, so the next step uses the new model while the existing conversation history is preserved and no new Session is created. The selection is also persisted on the chat binding, so it survives `/new`, a Workspace switch, a Session resume, and a Runtime restart. A chat without its own selection falls back to `ctx.agentDefaultModel.currentSelection()`. A chat-level selection is never written to the dsh global default, so the Web UI and other Sessions are unaffected. If a persisted selection is no longer routable, the plugin falls back to the global default and says so once rather than degrading silently.

Reasoning effort is not selectable yet; the provider's own default applies.
