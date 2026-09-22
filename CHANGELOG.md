# Changelog

## 0.1.0-alpha.2 — prepared, unreleased

- Raise the evaluator transfer ceiling from 1.25 to 5 seconds, with 2-second connection, 5.5-second process and 6-second selection-wait bounds. Slow checkpoints can now wait longer; no retries were added.
- Show the last evaluator outcome and elapsed time in `/jevshift status`.
- Keep native fallback, stale-reply rejection and the unchanged selection prompt. Six bounded synthetic live checks passed. The maintainer subsequently confirmed the personal observe/auto/pin/manual-control checks; broader quality sign-off remains open.

## 0.1.0-alpha.1 — prepared, unreleased

- Jev recommendations from bounded Markdown/XML context; observe is the new-session default.
- Per-session status, setup, pin, off and explicitly gated auto controls.
- Native catalog discovery, model/effort/context validation and session-ID persistence.
- Bounded curl transport, stale-decision rejection and fail-safe model behavior.
- MIT license, installation/configuration/privacy/compatibility documentation, synthetic payload and exact public-file packaging.

Known limits: unresolved prompt-quality gate, repeated live evaluator deadline misses, low-effort-only overrides, experimental Claude Function Hooks, and same-native-default reselection not releasing a pin in the tested SDK path. No demonstrated routing or quota-saving advantage. Private repository review comes before public release; remote-install verification is pending.
