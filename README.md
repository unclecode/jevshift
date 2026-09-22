# JevShift

Let Jev recommend a Claude model as your work moves between design, implementation and cleanup. Keep a model pinned whenever you want.

**Experimental alpha — private review candidate.** Tested with Claude Code **2.1.278** on macOS using experimental Function Hooks. New sessions start in **observe**: Jev recommends, Claude keeps its native model. Automatic routing is an explicit opt-in for isolated testing. Selection quality and broad live-service reliability still need work; this project does not claim better coding results or quota savings.

## Try the local package

From this repository or an extracted release directory:

```sh
claude --version
curl --version
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir "$PWD" --effort low
```

Use Claude Code 2.1.278 for the tested setup and curl 8.4 or newer (tested 8.7.1). Claude needs its normal login. Bun is needed only for development tests; there is no npm install or build step for users. Other Claude versions and platforms have not been validated.

Inside the session:

```text
/jevshift status
/jevshift setup
/jevshift pin opus
/jevshift off
```

Pin/off work without a Jev key. `setup` discovers models and resets this session to observe. See [installation](docs/installation.md) for local marketplace installation and [configuration](docs/configuration.md) to connect Jev securely.

## Controls

| Command | Effect |
|---|---|
| `/jevshift status` | Show mode, last evaluator outcome/timing, native default, recommendation and requested/returned model. |
| `/jevshift setup` | Discover native models without an inference prompt; return to observe. |
| `/jevshift observe` | Ask Jev for recommendations; preserve Claude's chosen model. |
| `/jevshift pin sonnet` | Hold a supported model without Jev calls. Also accepts `opus`, `fable` or a discovered full ID. |
| `/jevshift off` | Stop evaluation and return to native model control. |
| `/jevshift auto` | Apply compatible recommendations when `experimental_auto` is enabled. |

Changes take effect at the next model request. Sessions keep separate controls even in the same directory. Same-session resume restores saved mode; new/forked sessions start observe. An actual native model change releases the plugin to off. Reselecting the same native default did not release a pin in the tested SDK path; use `/jevshift off` explicitly.

## What Jev sees

One model-choice question plus a bounded Markdown/XML state: the current instruction, recent visible messages, nearby plan/work excerpt and recent tool results. Known secret patterns are masked; hidden thinking is omitted. **Observe and auto send these excerpts to OpenRouter / TypeSafe Jev.** Masking is best effort, not a guarantee that private content is removed. Pin/off send no evaluator requests.

The policy prefers Fable for substantial planning, Opus for implementation and bounded debugging, and Sonnet for routine edits and explanations. These are preferences under evaluation. Inspect a [complete synthetic request](examples/jev-request.json) and the [data flow](docs/privacy.md) before adding a key.

## Evidence and limits

All eight small coding outcomes passed across fixed Sonnet, Opus, Fable and auto. Sonnet passed too, so the experiment did not demonstrate a routing advantage. The earlier alpha.1 auto planning run received two evaluator timeouts and safely retained native Opus. Alpha.2 increases the transfer cap from 1.25 to 5 seconds; six subsequent synthetic live checks passed, including replies beyond the old cap. The maintainer's subsequent personal test confirmed observe, automatic Fable/Opus/Sonnet transitions, pinning and native manual control. These bounded checks do not establish general reliability. The full comparison and control summary is in [validation](docs/validation.md).

Overrides are limited to tested low effort and compatible context windows. Unavailable or failed pins block further inference until you choose another model or turn the plugin off. The evaluator's alpha API and Claude's experimental hook interface can change. See [compatibility](docs/compatibility.md).

## Develop

```sh
bun test ./tests
python3 scripts/package.py --check
python3 scripts/package.py --output dist
```

The package builder copies only the reviewed files in [public-files.json](public-files.json). Private labs, transcripts, credentials and historical working reports stay outside the package and Git publication set. [Development guide](docs/development.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE).

This is an independent project, not an Anthropic or TypeSafe product. Public release awaits the maintainer's review; this candidate is intended for private repository review first.
