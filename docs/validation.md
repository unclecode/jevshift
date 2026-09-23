# Validation and unresolved issues

This is a reviewed public summary of private labs conducted 20–23 September 2026. Raw user transcripts, account profiles, run logs and internal working reports are excluded from publication. Synthetic unit tests and one synthetic request example are included. Historical evidence is not a reproducible public benchmark without the private inputs.

## Alpha.4: native alias discovery, 23 September 2026

The source suite passed **106 tests / 494 assertions**, including shuffled catalogs, conflicting/default rows, missing aliases, disabled entries, exact older pins, family updates, resume, failed/stale refresh and 1M-context preservation. Four Python packaging tests also passed. Neither the model nor effort prompt changed.

Real no-inference SDK probes resolved Sonnet 5, Opus 5.5 and Fable 5.1 through the installed Claude Code **2.1.280** binary. The Fable menu used a concrete ID rather than a `fable` alias row; checking the applied model separately avoided relying on menu spelling or row order.

A native mock-provider workflow passed observe, auto, independently pinned dimensions and invalid-reply fallback using actual alias discovery. A separate installed-plugin session passed 14 native command checks, including startup discovery, refresh preserving a family pin and medium effort, and an exact version pin remaining fixed. Installation and removal used an isolated profile, synthetic credentials, disabled evaluator traffic and a closed local inference endpoint. Version changes across catalog refresh/resume were simulated in unit tests, not by changing Anthropic's live catalog.

These checks establish alias resolution and controls in the tested CLI. They do not validate other providers or future CLI protocols, prove that every recommended model is accessible to every account, or change the existing routing-quality and savings limitations.

## Alpha.3: model and effort, 23 September 2026

The source suite passed **95 tests / 409 assertions**, with four additional Python packaging tests. Coverage includes independent pins, supported efforts and caps, incomplete replies, stale decisions, native takeover, persistence and reversal handling. Native plugin/hook and marketplace validation passed on Claude Code **2.1.280**.

The frozen effort-v2 policy pilot used 30 fresh synthetic cases, six per effort level. Jev matched **29/30 effort labels**, **27/30 model labels** and **26/30 complete pairs**. Selected efforts were low 7, medium 5, high 6, xhigh 6, max 6. On the original 30 cases, effort agreement improved from 21/30 to 25/30, with two upward regressions retained. Across the 66-call pilot, all replies were structurally valid, five repeated boundary cases were stable, and reported evaluator cost was $0.003985338. These are same-author policy labels, not independent task-quality or optimal-compute measurements. Model-v7 instructions are unchanged.

Native mock runs verified all 15 model/effort combinations, upward/downward changes, native release, observe passthrough, independent questions and invalid-reply fallback. Separate live runs then made **27 real Claude requests**, all returning HTTP 200:

- All five effort levels on Sonnet 5, Opus 5.5 and Fable 5.1, followed by max-to-low switching and native `/effort medium` takeover.
- Automatic planning with Fable/high, serializer implementation with Opus/low, and documentation with Sonnet/low in one conversation. Read/Write tool calls completed across the model changes. Four functional serializer cases passed eight assertions afterward.
- Observe retained native Sonnet/low. A pinned Opus model allowed Jev to select only effort; fixed medium effort allowed Jev to select only the model.

Seven live Jev decisions completed in **468–895 ms**, with $0.000507276 reported evaluator cost and no unknown billing in this sample. Claude Code reported $1.0774718 in API-equivalent cost across the 27 requests; that is not a measurement of subscription quota or the amount charged to an account. No credentials were logged or included in the package.

The serializer's initial effort choice was low with probabilities low 0.54 / medium 0.46. Its functional checks passed, but this remains a policy boundary, not proof that low is always sufficient for implementation. The documentation task wrote two explanatory lines plus a heading, so it was not an exact two-line file. Those observations are retained rather than treated as perfect task compliance.

The live checks verified outgoing effort fields and returned model IDs. They do not establish model internals, cache preservation, quota savings or better outcomes. Cache reads occurred within some tool loops; misses also occurred after changes. A native test-harness startup race initially stopped before any inference; waiting for asynchronous hook initialization corrected the harness without changing production logic.

An extracted package containing only the 54 allowed public files passed the same 95 tests. In a disposable profile it installed through a local marketplace, passed nine native command checks (including effort pins and disabled-auto behavior), then uninstalled cleanly. These installation checks used synthetic credentials, disabled evaluator traffic and a closed local inference endpoint. Private paths, account labels and credential patterns were checked separately before publication.

## Established in the tested environment

- Native Function Hooks can override the request model while preserving streamed responses and tool context.
- Separate sessions in the same directory can hold independent pins. An actual SDK model change releases a pin to off and the next response uses the native choice.
- Observe-mode real coding retained all eight native Opus responses while Jev recommended Opus, Opus and Sonnet.
- Eight isolated coding outcomes (implementation and debugging × Sonnet/Opus/Fable/auto) passed 36 executed test instances / 192 assertions. All original 16 task/condition comparison cells now have completed attempts, with the interrupted attempt retained separately.
- Four additional planning conditions completed at 8,192 output tokens without truncation. They are separate from the original 2,048-token cohort.
- Failure/concurrency tests on synthetic providers passed 80 local tests / 348 assertions and 43 native scenario checks across 19 processes. A reproduced four-second stalled-evaluator case no longer held up the next SDK turn: it reached inference in 21 ms in both tested stalls. This is not a latency guarantee.

## What remained unresolved after the original pilot

**Selection quality:** three frozen prompt revisions produced 336 valid decisions. No revision passed all quality gates. Current v7 matched 26/30 historical policy references and 12/12 newly authored synthetic cases, but retained only 7/10 routine Sonnet references in the earlier balanced synthetic set (minimum 8). Labels are policy judgments; new synthetic cases and partial artifact blinding are not independent real-world validation.

**No demonstrated routing advantage:** fixed Sonnet passed both coding tasks too. Small, isolated fixtures, low effort, one run per cell, different context variants and cache behavior prevent a general quality/cost ranking. No quota-saving claim is justified.

**Live deadline misses:** across the real-work pilot there were 14 Jev attempts, 11 with reported usage and three timeouts with unknown billing. Two timeouts occurred in the larger-output auto planning run; native Opus was retained. Auto did not receive a recommendation in that run. The initial diagnostic used relaxed limits, so the mixed sample is not a production timeout-rate estimate.

**Planning/documentation:** no larger-output design met every rubric and word-count requirement. Fixed Opus reached 13/16 on the design rubric but exceeded the word limit. Both newly completed documentation conditions scored 15/16 but exceeded their word limit. Earlier overload interruptions and safeguard errors were preserved, not converted into successes.

**Manual pin release:** reselecting the already-selected native default did not release a request-level pin in the tested SDK path. Use explicit off or an actual native model change. Interactive same-model reselection remains untested.

**General availability:** experimental Function Hooks and the evaluator's alpha endpoint may change. macOS/native CLI is the only validated environment. Secure-storage interaction, broad terminal rendering and remote installation are not established by the lab controls.

## Release posture

The package starts in observe; auto requires explicit configuration and a command. A general auto-mode release needs new frozen prompt-quality validation and a measured resolution of evaluator latency. The public repository is an experimental preview with these limits visible. The documented terminal install path passed from the public GitHub URL in an isolated profile.

## Alpha.1 package preparation: 22 September 2026

Both plugin and marketplace manifests passed native Claude validation. The source suite passed 80 tests / 348 assertions; four additional Python packaging tests checked exclusion of unlisted/private files, repeatable ZIP output, overwrite refusal, external symlink/path rejection, defaults and missing dependencies. The synthetic request matched the current collector and evaluator prompt.

An extracted allowlisted package installed through a local marketplace in a disposable profile. Six native command checks passed (status, setup, gated auto, pin, off, observe), followed by uninstall and marketplace removal. A separate session loaded the shipped local auto-settings example and passed the same six checks with auto explicitly enabled. Both processes exited normally. Credentials were synthetic, the inference endpoint was an unreachable loopback address, evaluator transport was disabled, and only local commands were submitted. These checks prove loading/control configuration, not model inference or real secure-key storage.

Two harness corrections were retained privately: a static test sentinel matched its own source text, and the first native probe incorrectly treated Claude's zero-token synthetic slash-command reply as inference. Corrected probes passed without changing production source. Runtime, prompt and existing unit tests are unchanged in this packaging step. At the time of this package test, GitHub publication, remote installation and secure-configuration UI verification were pending.

## Alpha.2: personal-test timeout correction

The first personal observe-mode test timed out and kept native Opus. Its screenshot/transcript did not include a precise evaluator duration. Alpha.1's transfer cap was 1.25 seconds; alpha.2 changes the nested bounds to 2 seconds for connection, 5 seconds for transfer, 5.5 seconds for the host process and 6 seconds for the outer selection wait. The trade-off is a longer possible delay at evaluation checkpoints. No retries were added and the evaluator prompt is unchanged.

A frozen sequence of six synthetic requests through the native production transport all returned valid, billed Jev replies: 3,843, 581, 964, 562, 638 and 1,709 ms, with $0.000193284 total reported evaluator cost and no unknown charges. Claude inference was simulated. The choices were Fable/Opus/Sonnet twice, but these transport checks are not new independent quality evidence. The two replies longer than the old cutoff illustrate why that cutoff was too tight for this test.

The runtime suite passes 82 tests / 359 assertions, including a response after the previous deadline and timeout/success status reporting. General quality sign-off is still open, and six timely replies do not establish latency reliability.

The updated native fault suite passed 43 scenario checks across 19 cleanly exited processes with simulated providers, including eight-second stalled headers/body, interruption, concurrency, unavailable models and recovery. In the two stalled-response cases, transport timed out around five seconds and the next prompt reached inference 27 ms / 22 ms later. All earlier failure evidence remains unchanged. These results verify the bounded cleanup path, not live-provider availability.

## Personal acceptance and private review: 22 September 2026

The maintainer supplied status output showing an observe-mode Fable recommendation with native Opus retained (2,253 ms), then an auto-mode Fable recommendation with Fable requested and returned (2,665 ms). The maintainer also reported the expected Opus implementation and Sonnet documentation transitions, Sonnet pin hold during planning, and native manual selection releasing the plugin to off. The latter checks are user reports, not a new independently audited trace or benchmark.

Personal acceptance is complete. The repository was created privately for README and package review, then the maintainer made it public. Personal acceptance does not close the prompt-quality gate above.

## Public GitHub installation: 22 September 2026

The documented terminal path added `unclecode/jevshift` as a marketplace and installed `jevshift@jevshift` version 0.1.0-alpha.2 in a disposable Claude Code profile. The native session initialized, and status, setup, gated auto, pin, off and observe all passed. Uninstall and marketplace removal passed. A second isolated run disabled SSH and saved Git settings; Claude Code retried the public repository over HTTPS and the same checks passed. Both runs used a synthetic Claude credential and closed loopback inference endpoint, with zero paid model calls. The one-line in-session shortcut also prompted for source approval, installed and activated the plugin, and opened the plugin options UI. That interactive pass accepted the default Project scope; the README directs users to select User, which was separately validated by the terminal install. No real key was entered, so sensitive-key storage and masking with a value remain untested.
