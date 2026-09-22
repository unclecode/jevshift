# Installation

## Requirements

The tested combination is macOS, Claude Code 2.1.278 with experimental Function Hooks, and curl 8.7.1. curl 8.4+ is required for the transport's response-size cap. Use low effort for model overrides. Check `claude --version` and `curl --version` before starting. Your Claude account must have access to the model you select; JevShift does not provide models, subscriptions or account rotation.

The Function Hooks interface and enable flag were verified against the installed CLI and its exported types. This is experimental compatibility, not a promise that any later CLI will work. No separate Bun/Node runtime is required to load the plugin in the tested native CLI.

## One-session local loading

From the repository or extracted package directory:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir "$PWD" --effort low
```

From another project, replace the directory below with the actual absolute package path:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir /absolute/path/to/jevshift --effort low
```

Then run `/jevshift status` and `/jevshift setup`. Try `/jevshift pin opus` or `/jevshift off` without adding an evaluator key. Loading starts observe, but no Jev request is made without a configured key. This launch does not install the plugin globally. Exit and relaunch with the flag to load it again. Do not use `--safe-mode`: that disables plugins.

## Local marketplace installation

This repository includes a one-plugin marketplace. From its root:

```sh
claude plugin marketplace add "$PWD"
claude plugin install jevshift@jevshift --scope user
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --effort low
```

This writes to your Claude user profile. Restart to load the installed plugin. Do not also pass `--plugin-dir` for the same plugin. Keep the local marketplace directory available: local-directory marketplaces may load the plugin in place.

Inside Claude, use `/plugin configure jevshift@jevshift` to set the sensitive key or non-secret options. [Configuration](configuration.md) explains the choices. The native configuration UI/storage behavior is documented by Claude; the package verification uses an isolated profile and non-secret settings, not your real secure-storage flow.

To remove this installation:

```sh
claude plugin uninstall jevshift@jevshift --scope user
claude plugin marketplace remove jevshift
```

To stop it only for the current session, use `/jevshift off`. Removal does not promise deletion of Claude's saved plugin configuration or credentials; use Claude's configuration controls to clear a key.

## GitHub installation status

No published repository URL is assigned in this candidate. A GitHub marketplace install and fresh-profile verification belong to the publication step. Do not substitute an assumed owner/repository URL or claim that remote installation is tested yet.

Claude documents [session-only plugin loading](https://code.claude.com/docs/en/plugins), [marketplace sources](https://code.claude.com/docs/en/plugin-marketplaces), and [plugin configuration](https://code.claude.com/docs/en/plugins-reference#user-configuration). Those references cover the packaging system; the tested experimental Function Hooks interface comes from the local CLI.
