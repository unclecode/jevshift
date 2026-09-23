# Changelog

## 0.1.0-alpha.3: model and thinking effort

- Ask Jev for model and effort in one bounded request. Apply only a complete, supported pair.
- Support low, medium, high, xhigh and max using native model capabilities. Add an optional plugin effort cap.
- Pin either dimension independently, or both without Jev. Preserve existing model-only pins with native effort.
- Show recommended/requested effort in status. Native effort changes release plugin control, alongside native model changes.
- Extend stale-response, fallback, persistence and reversal handling to effort. New sessions still start observe, and automatic control still requires opt-in.
- Pass 95 offline tests, 4 packaging tests, native mock integration and 27 real Claude requests. Seven live Jev decisions covered automatic pairs, observe and independent pins. These validate mechanics, not optimal effort or savings.

## 0.1.0-alpha.2: public preview

- Raise the evaluator transfer ceiling from 1.25 to 5 seconds, with 2-second connection, 5.5-second process and 6-second selection-wait bounds. Slow checkpoints can now wait longer; no retries were added.
- Show the last evaluator outcome and elapsed time in `/jevshift status`.
- Keep native fallback, stale-reply rejection and the unchanged selection prompt. Six bounded synthetic live checks passed. The maintainer subsequently confirmed the personal observe/auto/pin/manual-control checks; broader quality sign-off remains open.

## 0.1.0-alpha.1: prepared, unreleased

- Jev recommendations from bounded Markdown/XML context; observe is the new-session default.
- Per-session status, setup, pin, off and explicitly gated auto controls.
- Native catalog discovery, model/effort/context validation and session-ID persistence.
- Bounded curl transport, stale-decision rejection and fail-safe model behavior.
- MIT license, installation/configuration/privacy/compatibility documentation, synthetic payload and exact public-file packaging.

Original alpha.1/alpha.2 limits included an unresolved prompt-quality gate, repeated live evaluator deadline misses and low-effort-only overrides. Alpha.3 expands effort support, but experimental Claude Function Hooks, limited quality evidence and same-native-default reselection remain limitations. No routing or quota-saving advantage has been demonstrated. Public users need their own Claude login and an OpenRouter key for Jev recommendations.
