# Installation

Choose an in-session install or a terminal install. They install the same plugin.

## Before you start

The tested setup is macOS with Claude Code **2.1.278**, experimental Function Hooks and curl **8.4+**. Use your normal Claude login. Your account must have access to the models you want to use.

Jev recommendations need an [OpenRouter key](https://openrouter.ai/keys). Pin and off work without one. There is no npm install or build step. Other Claude versions and platforms have not been validated.

## Install inside Claude Code

Paste this into a Claude Code terminal session:

```text
/plugin install jevshift --marketplace unclecode/jevshift
```

Confirm the marketplace source and choose **User** for all your projects. This shortcut requires Claude Code 2.1.275 or later and is present in the tested 2.1.278 CLI.

You can also add and install separately. Run each command in order:

```text
/plugin marketplace add unclecode/jevshift
```

```text
/plugin install jevshift@jevshift
```

## Install from a terminal

```sh
claude plugin marketplace add unclecode/jevshift
claude plugin install jevshift@jevshift --scope user
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --effort low
```

The `--marketplace` shortcut above is an in-session command. Use the two separate install commands in the shell.

## Configure once

Inside Claude Code:

```text
/plugin configure jevshift@jevshift
```

Set **OpenRouter API key** in the masked field. Turn on **Enable experimental auto control** if you want to use automatic switching. Leave the other settings at their defaults. Save, exit Claude, and restart:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --effort low
```

Use this launch command for sessions that need JevShift. Existing sessions do not acquire a launch environment variable through a plugin install. A restart also loads the saved plugin options.

Run `/jevshift setup`, then send a task. `/jevshift status` shows the recommendation and the model that actually answered. New sessions begin in observe. Use `/jevshift auto` to apply recommendations.

For environment keys and advanced settings, see [configuration](configuration.md). Do not put a real key in a command-line `--config` argument or a JSON file committed to Git.

## Try a clone without installing it

Clone this repository into a new directory, then load it for one session:

```sh
git clone https://github.com/unclecode/jevshift.git
cd jevshift
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir "$PWD" --effort low
```

This does not install the plugin globally. Use it when testing changes or inspecting the code. Do not combine local loading with an installed copy in the same session. Exit and omit `--plugin-dir` to stop loading the local copy.

Local loading uses the plugin identity `jevshift`; marketplace installation uses `jevshift@jevshift`. The [local settings examples](../examples/README.md) explain environment-key use and explicit auto opt-in.

## Update

From a terminal:

```sh
claude plugin marketplace update jevshift
claude plugin update jevshift@jevshift
```

Restart Claude with the JevShift launch command after updating. Keep the installed version in mind when reporting a problem.

## Remove

From a terminal:

```sh
claude plugin uninstall jevshift@jevshift --scope user
claude plugin marketplace remove jevshift
```

For a temporary pause, use `/jevshift off`. Uninstalling does not guarantee removal of saved credentials; clear a key through Claude's plugin settings before uninstalling if needed.

## If it does not load

Run `/plugin` and check its Errors tab. Confirm the Claude version, restart with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`, and avoid safe mode, which disables plugins. See [compatibility](compatibility.md) for model, effort and timeout issues.

Claude's [installation guide](https://code.claude.com/docs/en/discover-plugins) documents marketplace installation and the in-session shortcut. Its [plugin reference](https://code.claude.com/docs/en/plugins-reference#user-configuration) covers options and sensitive storage. The experimental Function Hooks launch requirement was verified against the installed 2.1.278 CLI.
