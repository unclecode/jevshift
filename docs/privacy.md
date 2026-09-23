# Privacy and evaluator cost

## Data flow

Claude's native conversation → bounded visible-context collector → one Jev request with model and effort questions → validated recommendation → optional request-level model/effort override.

Observe, auto and a pinned model with automatic effort send context to `https://openrouter.ai/api/alpha/decisions`, serving TypeSafe Jev. A pinned dimension is omitted from the questions. A native Claude login authenticates Claude inference separately. JevShift neither reads Claude OAuth files nor changes account tokens, and is not an account router.

The collector includes the current instruction (up to 1,600 UTF-8 bytes), six recent visible messages (350 bytes each), a nearby visible plan/work excerpt (1,100 bytes), and up to three tool-result excerpts (650 bytes each). Whole state and serialized-state limits are 7,000 bytes; the full evaluator JSON is capped at 9,000 bytes. The payload adds supported model/effort choices and fixed controls. If needed, older message, plan and tool sections are omitted in that order to fit both questions while retaining the current request. Limits can affect decisions. The XML-delimited state is evidence, not additional instructions to Claude.

Known credentials, secret assignments, email addresses and home-path patterns are masked. Hidden thinking is excluded. **Unknown secrets, proprietary code and other sensitive content can still appear.** Only enable evaluation for material you are willing to send to those providers. The plugin does not change their retention or training policies.

Off, model-only pins with native effort, and fully fixed model/effort pins send no new Jev calls. A pinned model with automatic effort still calls Jev. Switching away invalidates an outstanding decision; it cannot retract content already sent. Missing credentials or native nonessential-traffic opt-out prevent new evaluator transport.

## Local storage and diagnostics

The plugin persists session ID, mode, model/effort controls and blocked state through Claude's plugin store. Model pins retain either a family alias or an exact ID. Startup/refresh helpers read native catalog and applied-model settings; only validated model IDs and efforts are retained in memory. Account details and unrelated settings from helper responses are discarded. It does not persist collected conversation excerpts or evaluator request bodies. Native Claude transcripts/debug logs are separately managed by Claude. Plugin diagnostics contain decision metadata, timing, model IDs, efforts and available usage; raw error bodies and keys are excluded. Inspect any logs before sharing them.

Use Claude's sensitive plugin option for a key, or explicitly permit an already-inherited environment key. Claude owns secure storage and may fall back to a credential file. The evaluator credential/body pass to curl through stdin, not shell arguments. The transport disables default curl configuration, redirects and retries. curl's usual environment/network behavior can still apply.

## Billing and limits

OpenRouter bills Jev separately from the Claude subscription. The alpha uses a maximum of three evaluator checkpoints per instruction in auto, one outstanding evaluation per session, and bounded request/output sizes. It has **no global session/day spending cap**. Missing/timeout usage means unknown billing, not zero. Consult provider pricing before use; historical experiment costs are not a price guarantee.

No calibrated mapping from API token/cost estimates to Claude weekly subscription quotas is established. The plugin neither measures nor balances subscription quotas. [Validation](validation.md) separates mechanics from savings/quality claims.

The checked-in [request example](../examples/jev-request.json) is fully synthetic. No private transcript, real key or native account profile is included.
