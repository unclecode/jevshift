# JevShift

I've been fascinated by Jev and the idea of small, focused models making decisions inside software. I've been interested in this approach for the last couple of years, and I'm already using these ideas in several parts of my workflow.

One thing I need every day is intelligent model switching. When I work in Claude Code, I don't want to use Fable, Opus or Sonnet for everything. I want the model to fit the work, with the option to take control whenever I need to. That's why I built JevShift, and why I'm sharing it.

## How it works

JevShift asks Jev to choose a model using your request, recent conversation, plan and tool results. It can switch models inside the same Claude Code conversation.

| Work | Preferred model |
|---|---|
| Substantial planning and design | Fable |
| Implementing an agreed plan and debugging | Opus |
| Small edits, explanations and documentation | Sonnet |

These are preferences, not guaranteed choices. New sessions start in **observe** mode: you see recommendations while Claude keeps its current model. Turn on **auto** when you're ready, or **pin** a model yourself.

**Experimental alpha.** Tested on macOS with Claude Code **2.1.278**. Requires curl **8.4+**, low effort, your Claude login and model access. Jev recommendations use a separate [OpenRouter API key](https://openrouter.ai/keys). No build or npm install is needed.

## Quick install

Choose either method. While this repository is private, your GitHub login must have access to it.

### Inside Claude Code

Paste this into a Claude Code terminal session:

```text
/plugin install jevshift --marketplace unclecode/jevshift
```

Confirm the source and choose **User** to make the plugin available across your projects.

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

Use that launch command for JevShift sessions. The restart loads your settings and enables the experimental hooks this alpha needs. You can use pin/off without a Jev key.

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

Try planning a small feature, implementing the agreed plan, then updating its documentation. Use status after each phase to see the actual model used.

## Commands

| Command | What it does |
|---|---|
| `/jevshift status` | Show mode, recommendation, timing and the requested/returned model. |
| `/jevshift setup` | Discover models and return to observe mode. |
| `/jevshift observe` | Recommend a model without changing it. |
| `/jevshift auto` | Apply recommendations when auto is enabled in settings. |
| `/jevshift pin sonnet` | Hold Sonnet. Also accepts `opus`, `fable` or a discovered model ID. |
| `/jevshift off` | Return control to Claude Code. |

Changes apply to the next model request. Each session keeps its own controls. Changing the native model to a different choice turns JevShift off; `/jevshift off` always releases a pin.

## Privacy and limits

Observe and auto send short conversation, plan and tool excerpts to **OpenRouter / TypeSafe Jev**. Known secret patterns are masked, but private content can still be included. Pin and off make no Jev calls. See [what gets sent](docs/privacy.md) and a [complete synthetic request](examples/jev-request.json).

This is an early preview. Evaluator calls can add delay or time out, and model choices still need broader testing. A timeout keeps the incoming model. We have tested switching and controls, but have not established better task outcomes or quota savings. See [validation](docs/validation.md) and [compatibility](docs/compatibility.md).

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
