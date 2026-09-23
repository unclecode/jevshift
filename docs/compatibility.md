# Compatibility and troubleshooting

| Component | Tested / required |
|---|---|
| Claude Code | 2.1.280 for alpha.3/alpha.4; experimental Function Hooks enabled at launch. No broader version range verified. |
| Operating system | macOS only. Linux, Windows, remote machines and IDE/desktop-hosted sessions unvalidated. |
| Runtime | Native Claude CLI loads TypeScript hook modules. Bun 1.3.1 used for development tests only. |
| Evaluator transport | curl 8.4+ required; tested 8.7.1 on PATH. No redirects or automatic request retries. |
| Evaluator | `typesafe/jev-1.13`, OpenRouter alpha decisions API. Availability and billing are provider-controlled. |
| Claude tiers | Native catalog discovery: Sonnet, Opus and Fable when offered with recognized effort levels. |
| Observed IDs | `claude-sonnet-5`, `claude-opus-5-5`, `claude-fable-5-1`; the catalog may expose `[1m]` variants. These are observations, not hard-coded aliases or an access guarantee. |
| Override effort | `low`, `medium`, `high`, `xhigh`, `max`, restricted to the selected model's discovered support and the configured plugin cap. All 15 combinations passed a live request check. |
| Context compatibility | A native `[1m]` selection uses a discovered 1M variant of the resolved version. Without one, the family is rejected for that request. Exact pins are never rewritten to another variant. |
| Providers | Native Claude account tested. Bedrock, Vertex, Foundry and custom gateways unvalidated. |
| Workflows | Main-session requests tested. No claim for subagent/agent-team/remote routing, joining already-running processes or interactive layout under every terminal. |

## Common issues

**`/jevshift` is unavailable:** restart with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`, check the plugin path or installation, use the tested CLI version, and avoid safe mode. Inspect Claude's plugin error view. A schema-valid manifest alone does not prove hooks loaded.

**Discovery fails:** check `claude_executable` and the normal native login. Three isolated safe-mode SDK helpers run concurrently, one per family alias, each with an eight-second process timeout. Each initializes the catalog and reads the applied model through `get_settings`, with no inference prompt or Jev call. Unsupported resolver responses, disabled entries and unverified efforts are rejected. `/jevshift refresh` retries without resetting controls; `/jevshift setup` returns to observe on success.

**A newer model is missing:** update Claude Code and run `/jevshift refresh`. JevShift follows its effective aliases, including provider configuration and explicit overrides. It does not infer availability from release announcements. Status shows the versions actually resolved. See Claude's [model aliases](https://code.claude.com/docs/en/model-config#model-aliases).

**No recommendation:** check the key option and explicit environment opt-in. Native nonessential-traffic opt-out (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`) disables evaluator transport. Missing curl, HTTP errors, invalid replies, unavailable candidates and deadlines preserve incoming values for automatic choices and compatible explicit pins. The transport uses a 2-second connection limit, 5-second transfer limit, 5.5-second host-process limit and 6-second outer selection wait. A slow evaluator can therefore add up to roughly 6 seconds at an eligible checkpoint. `/jevshift status` shows the last evaluator outcome and elapsed time. Slower provider replies can still time out. Do not interpret missing billed usage as a free request.

**Pin blocked:** the chosen model was unavailable, incompatible with effort/context, failed, or returned a different model. Select a valid pin or `/jevshift off`. JevShift does not silently rotate accounts or spend a different subscription.

**The native picker still shows another model:** request-level overrides and the native default are distinct. Use `/jevshift status`. Same-native-default SDK reselection did not release a pin; an actual native change or explicit off did. Interactive same-model picker reselection remains untested.

**Effort did not change:** observe is advisory, and fixed effort is preserved until changed explicitly. Auto rejects a pair if the catalog or plugin cap does not allow it. Native `/effort <level>` deliberately releases plugin control. Use `/jevshift auto` to resume automatic selection of both dimensions.

**Effort and caching:** the hook updates Claude's request effort. The live request check verified `output_config.effort`; Opus and Fable also carried per-message effort metadata. Effort changes can affect caching, and no cache-preservation or savings guarantee is established. Higher effort does not imply a fixed token count or equal compute across models. See Claude's [effort setting](https://code.claude.com/docs/en/model-config#adjust-effort-level) and [API effort reference](https://platform.claude.com/docs/en/build-with-claude/effort).

**Resume surprises:** controls belong to the session ID. Same-session resume restores validated saved state; forks/clear start observe. Saved auto becomes off when experimental auto is unavailable. A saved invalid pin blocks instead of being silently downgraded.

This alpha keeps the quality and latency limitations documented in [validation](validation.md).
