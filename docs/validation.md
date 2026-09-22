# Validation and unresolved issues

This is a reviewed public summary of a private lab conducted 20–22 September 2026. Raw user transcripts, account profiles, run logs and internal working reports are excluded from publication. Synthetic unit tests and one synthetic request example are included. Historical evidence is not a reproducible public benchmark without the private inputs.

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

The package starts in observe; auto requires explicit configuration and a command. A general auto-mode release needs new frozen prompt-quality validation and a measured resolution of evaluator latency. The current candidate may be evaluated as an experimental preview, with these limits visible. The private GitHub repository has been created. A fresh install from its public URL remains a release check.

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

Personal acceptance is complete. The repository was created privately for README and package review. Public visibility, release and launch remain subject to the maintainer's decision. Personal acceptance does not close the prompt-quality gate above.
