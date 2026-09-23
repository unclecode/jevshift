# JevShift

I've been fascinated by Jev and the idea of small, focused models making decisions inside software. I've been interested in this approach for the last couple of years, and I'm already using these ideas in several parts of my workflow.

One thing I need every day is intelligent model switching. When I work in Claude Code, I don't want to use Fable, Opus or Sonnet for everything. I want the model to fit the work, with the option to take control whenever I need to. That's why I built JevShift, and why I'm sharing it.

## How it works

JevShift asks Jev to choose a model and thinking effort using your request, recent conversation, plan and tool results. It can change both inside the same Claude Code conversation.

| Work | Preferred model |
|---|---|
| Substantial planning and design | Fable |
| Implementing an agreed plan and debugging | Opus |
| Small edits, explanations and documentation | Sonnet |

Effort is chosen separately: **low** for routine work, **medium** for bounded problems, **high** for substantial reasoning, **xhigh** for difficult interactions, and **max** for exceptional analysis. An agreed plan can still need high effort to implement.

These are preferences, not guaranteed choices. New sessions start in **observe** mode: you see recommendations while Claude keeps its current model and effort. Turn on **auto** when you're ready, or pin either choice yourself.

**Experimental alpha.** Tested on macOS with Claude Code **2.1.280**. Requires curl **8.4+**, your Claude login and model access. Jev recommendations use a separate [OpenRouter API key](https://openrouter.ai/keys). No build or npm install is needed.

## Quick install

Choose either method.

### Inside Claude Code

Paste this into a Claude Code terminal session:

```text
/plugin install jevshift --marketplace unclecode/jevshift
```

Confirm the source and choose **User** to make the plugin available across your projects. Claude Code may initially select Project scope.

### From your terminal

```sh
claude plugin marketplace add unclecode/jevshift
claude plugin install jevshift@jevshift --scope user
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --effort low
```

### Connect Jev

Inside Claude Code, open the plugin settings:

```text
/plugin configure jevshift@jevshift
```

Enter your **OpenRouter API key** in the masked field. To try automatic switching, turn on **Enable experimental auto control**. Save, exit Claude, then start it with:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --effort low
```

Use that launch command for JevShift sessions. The restart loads your settings and enables the experimental hooks this alpha needs. `--effort low` sets the starting native effort; auto can choose any supported level. Manual pins and off work without a Jev key.

## Try it

First, discover your available models:

```text
/jevshift setup
```

Send a task, then check what Jev recommended and which model answered:

```text
/jevshift status
```

To let JevShift apply its recommendations:

```text
/jevshift auto
```

Try planning a small feature, implementing the agreed plan, then updating its documentation. Use status after each phase to see the returned model and requested effort.

## Commands

| Command | What it does |
|---|---|
| `/jevshift status` | Show recommendations, timing, requested effort and requested/returned model. |
| `/jevshift setup` | Discover models and return to observe mode. |
| `/jevshift observe` | Recommend model and effort without applying them. |
| `/jevshift auto` | Choose both automatically when auto is enabled in settings. |
| `/jevshift pin sonnet` | Hold Sonnet with native effort. No Jev calls. Also accepts `opus`, `fable` or a discovered model ID. |
| `/jevshift pin opus high` | Hold both model and effort. No Jev calls. |
| `/jevshift effort medium` | Fix effort while keeping the current model policy. In observe, this stays advisory. |
| `/jevshift effort auto` | Let Jev choose effort, including with a pinned model. Requires auto enabled to apply changes. |
| `/jevshift effort native` | Keep Claude's native effort while retaining the model policy. |
| `/jevshift off` | Return control to Claude Code. |

Changes apply to the next model request. Each session keeps its own controls. Changing the native model or effort turns JevShift off; `/jevshift off` always releases both. See [independent pin examples](docs/configuration.md#model-and-effort-control).

## Privacy and limits

Observe, auto and a pinned model with automatic effort send short conversation, plan and tool excerpts to **OpenRouter / TypeSafe Jev**. Known secret patterns are masked, but private content can still be included. Fully manual pins and off make no Jev calls. See [what gets sent](docs/privacy.md) and a [complete synthetic request](examples/jev-request.json).

This is an early preview. Evaluator calls can add delay or time out, and choices still need broader testing. A failed evaluation keeps native values for automatic choices and preserves valid manual pins. Effort is a reasoning preference, not a token budget. We have tested switching and controls, but have not established better task outcomes, cache preservation or quota savings. See [validation](docs/validation.md) and [compatibility](docs/compatibility.md).

## Demo

A screen-recorded walkthrough is coming soon.

## More details

- [Installation, updates and removal](docs/installation.md)
- [Configuration and environment keys](docs/configuration.md)
- [Development and packaging](docs/development.md)
- [Contributing](CONTRIBUTING.md)

| Folder | Contents |
|---|---|
| `.claude-plugin/` | Plugin metadata and marketplace listing. |
| `hooks/` | Claude Code integration. |
| `src/` | Context collection, Jev calls, model selection and controls. |
| `tests/` | Offline tests. |
| `examples/` | Synthetic request and sample settings. |
| `docs/` | Setup guides, compatibility and test results. |

## About me

I'm [UncleCode](https://twitter.com/unclecode). Follow me for updates and more tools from my workflow.

I also build [Crawl4AI](https://github.com/unclecode/crawl4ai), an open-source web crawler for AI applications with **84K GitHub stars**. If you work with web data, take a look.

[MIT license](LICENSE). An independent project, not affiliated with Anthropic, TypeSafe or OpenRouter.
