# Configuration

New sessions start **observe** and resolve the native model aliases. A missing evaluator key leaves Claude's native requests unchanged and shows a setup notice. Manual pins and off do not need OpenRouter. `/jevshift refresh` refreshes discovery while preserving controls; `/jevshift setup` refreshes and resets to observe. Neither collects or stores an API key. Catalog presence does not guarantee account access or quota.

## Model versions

JevShift asks the installed Claude executable to resolve `sonnet`, `opus` and `fable`, then checks the resulting versions against its supported-model catalog. It does not select whichever version appears first or has the largest number. Resolution follows that Claude installation's provider and model configuration, which can intentionally point to an older version. Keep Claude Code updated to follow its recommended releases.

The mapping is cached for the current process. New processes discover again at startup, including resumed sessions. Use `/jevshift refresh` to discover again without leaving auto or losing a pin. No background polling or automatic CLI update runs. If discovery fails completely, refresh leaves the existing mapping and controls unchanged; unavailable families are omitted when other families resolve successfully.

- `/jevshift pin opus` pins the family. After refresh or restart it uses the newly resolved Opus version.
- `/jevshift pin claude-opus-5-5` pins that exact ID, if discovery validates it. It stays fixed across refresh and resume. If the version disappears from discovery, the pin blocks rather than switching silently.
- Pins saved by alpha.3 and earlier already contain exact IDs. They stay exact; re-pin using a family name to follow new versions.

`/jevshift status` shows the resolved versions. An updated version does not automatically change Jev's task-selection policy. Adding a family such as Haiku or changing the planning/implementation preferences still requires a reviewed policy update.

## Add an evaluator key

Review [privacy](privacy.md) first. For the installed marketplace plugin, run this inside Claude:

```text
/plugin configure jevshift@jevshift
```

Set **OpenRouter API key** in the sensitive field. Claude manages its storage. On macOS its documentation specifies Keychain with a credential-file fallback; other platforms may use a credential file. JevShift does not guarantee that the key is encrypted on every machine. Restart after changing options.

Avoid passing real keys in command-line `--config` arguments, committed JSON, chat prompts or examples. A sensitive plugin key takes precedence over the environment key.

## Options

| Option | Default | Meaning |
|---|---|---|
| `openrouter_api_key` | Empty | Sensitive OpenRouter credential for observe/auto. |
| `use_environment_key` | `false` | Permit reading an already-inherited `OPENROUTER_API_KEY` if no plugin key is configured. |
| `experimental_auto` | `false` | Allow automatic model/effort control; does not turn auto on for new sessions. |
| `max_effort` | `max` | Highest effort JevShift may apply: `low`, `medium`, `high`, `xhigh` or `max`. |
| `claude_executable` | `claude` | Executable on PATH or absolute path used for no-prompt catalog discovery. |

No endpoint, prompt, model-ID or timeout override is exposed in this alpha. Candidate IDs and supported efforts come from the native catalog, restricted to Sonnet/Opus/Fable tiers. Jev uses `typesafe/jev-1.13` at the OpenRouter alpha decisions endpoint. The effort cap limits plugin overrides, including explicit pins; it does not change native settings or impose a token/spending limit. An automatic choice above the cap is rejected, not silently lowered.

## Local environment-key testing

If your shell already receives `OPENROUTER_API_KEY` from your credential manager, you can load the included non-secret settings file with the local package:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir "$PWD"   --settings "$PWD/examples/local-environment.settings.json" --effort low
```

The example opts in to environment-key use but leaves auto disabled. Use `examples/local-auto.settings.json` instead only for an isolated automatic-routing experiment, then explicitly run `/jevshift auto`. Both files contain only booleans; they do not read or store a key themselves.

These examples use the local plugin identity `jevshift`. An installed marketplace plugin uses `jevshift@jevshift`; configure that identity through Claude's UI. Project `.claude/settings.json` and `.claude/settings.local.json` are not supported sources for `pluginConfigs`; the local example works through explicit `--settings`.

## Model and effort control

Run each line in order for the behavior you want:

| Goal | Commands |
|---|---|
| Automatic model and effort | `/jevshift auto` |
| Automatic model, fixed high effort | `/jevshift auto`, then `/jevshift effort high` |
| Fixed Opus, automatic effort | `/jevshift pin opus`, then `/jevshift effort auto` |
| Fixed Opus and high effort | `/jevshift pin opus high` |
| Fixed Opus, native effort | `/jevshift pin opus` |
| Automatic model, native effort | `/jevshift auto`, then `/jevshift effort native` |
| Only recommendations | `/jevshift observe` |
| Native control of both | `/jevshift off` |

`auto` resets both choices to automatic. `pin <model>` resets effort to native. An `effort` command preserves the current model policy. In observe it stays advisory; from off it holds the native model and applies the requested effort policy. Automatic effort outside observe requires the experimental-auto option and a Jev key. Jev is asked only about dimensions that are automatic.

Inspect `/jevshift status` to distinguish the native defaults, recommendations, requested effort and returned model. Requested effort does not measure how much thinking the model actually did. A native model change, explicit `/effort <level>` command, or detected native effort change releases JevShift to off. Same-native-model reselection may leave a pin active; explicit off always releases it.

Only discovered effort levels and compatible context windows are admitted. Invalid or incomplete evaluator replies do not apply a partial model/effort change. Evaluator failure preserves compatible explicit pins and uses incoming native values for automatic choices. A failed pin stays blocked and reports how to recover. Re-pin deliberately, choose another pair, or use off. Native inference failure stops auto.

Selections are reconsidered on a new instruction, plan approval, repeated tool failures or sufficient new tool progress, with at most three evaluations per instruction. Routine tool calls reuse the current choice. This avoids a new evaluator call for every tool result while allowing difficult work to trigger a change.

Configuration storage and source precedence follow [Claude's user-configuration reference](https://code.claude.com/docs/en/plugins-reference#user-configuration).
