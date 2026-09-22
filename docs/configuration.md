# Configuration

New sessions start **observe**. A missing evaluator key leaves Claude's native requests unchanged and shows a setup notice. Pin and off do not need OpenRouter. `/jevshift setup` discovers the account's current native model catalog; it does not collect or store an API key, and it resets the session to observe.

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
| `experimental_auto` | `false` | Allow `/jevshift auto`; does not turn auto on for new sessions. |
| `claude_executable` | `claude` | Executable on PATH or absolute path used for no-prompt catalog discovery. |

No endpoint, prompt, model-ID, effort-policy or timeout override is exposed in this alpha. Candidate IDs come from the native catalog, restricted to supported Sonnet/Opus/Fable tiers. Jev uses `typesafe/jev-1.13` at the OpenRouter alpha decisions endpoint.

## Local environment-key testing

If your shell already receives `OPENROUTER_API_KEY` from your credential manager, you can load the included non-secret settings file with the local package:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir "$PWD"   --settings "$PWD/examples/local-environment.settings.json" --effort low
```

The example opts in to environment-key use but leaves auto disabled. Use `examples/local-auto.settings.json` instead only for an isolated automatic-routing experiment, then explicitly run `/jevshift auto`. Both files contain only booleans; they do not read or store a key themselves.

These examples use the local plugin identity `jevshift`. An installed marketplace plugin uses `jevshift@jevshift`; configure that identity through Claude's UI. Project `.claude/settings.json` and `.claude/settings.local.json` are not supported sources for `pluginConfigs`; the local example works through explicit `--settings`.

## Model control

Use `/jevshift pin opus` for a fixed model, `/jevshift observe` for recommendations, and `/jevshift off` for native control. Inspect `/jevshift status` to distinguish the native default from the requested/returned model. An actual native model change switches the plugin off. Same-native-model reselection may leave a pin active; explicit off is the reliable release command in this tested build.

Only low effort and compatible context windows are admitted. A failed pin stays blocked and reports how to recover. Re-pin to retry deliberately, select a different model, or use off. Auto timeouts keep the incoming native model; a native inference failure stops auto.

Configuration storage and source precedence follow [Claude's user-configuration reference](https://code.claude.com/docs/en/plugins-reference#user-configuration).
