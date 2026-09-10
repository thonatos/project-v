# @implementsio/dsh-telegram

Telegram Bot private-chat plugin for DeepSeek Harness.

Version `0.3.1` targets dsh `0.1.5-rc.1` and pins `node-telegram-bot-api` `2.1.0` (Bot API 10.3). The plugin continues to use standard text editing and media methods for streaming compatibility; the SDK's rich-message, ephemeral-message, disabled-button, and generation-stop additions are available for future transport features but do not change current message behavior.

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
- `/status`: show the current Workspace, Session, and task status
- `/stop`: stop the current Agent turn
- `/help`: show supported commands
- `/workspace`: choose a registered Workspace with inline buttons

Switching Workspace creates a new Session in that Workspace and persists the chat binding. The configured `workspaceId` remains the default when the chat has no valid binding. Unknown, unregistered, or unavailable Workspaces are rejected without changing the existing binding.
