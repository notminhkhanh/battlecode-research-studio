# Battlecode Research Studio

Battlecode Research Studio is a VS Code replay viewer for collaborative strategy research. It keeps the organiser's open-source renderer and adds a shareable research layer: bookmarks, time ranges, hypotheses, map highlights, and communication/action sequences.

The repository is private so the included `M228828.replay` and your team's analysis stay within the team.

## MVP features

- Open `*.replay` files directly in VS Code with the official UNSW Battlecode renderer.
- Add general notes, point bookmarks, and round ranges.
- Highlight cells and the dragons involved in an annotation.
- Review a research track above the normal replay controls and jump to evidence.
- Detect repeated exact sonar messages between allies and the receiver's next action.
- Keep observations, hypotheses, alternatives, confidence, and review status separate.
- Save everything beside the replay as `<replay>.research.json`, or use **Save as…**.
- Share the JSON sidecar through Git without duplicating the replay for every edit.

This first detector deliberately finds high-signal leads rather than claiming it decoded another team's protocol. “Message X was followed by MOVE W three times” is an observation; “X orders the receiver west” remains a hypothesis until you test alternatives.

## Get started

Requirements: VS Code 1.90+, Node.js 20+, pnpm, and Git with submodule access.

```sh
git clone --recurse-submodules git@github.com:notminhkhanh/battlecode-research-studio.git
cd battlecode-research-studio
pnpm install
pnpm package
```

Install the resulting `.vsix` in VS Code using **Extensions: Install from VSIX…**, then open `examples/M228828/M228828.replay`. The example sidecar is loaded automatically.

For development, open this repository in VS Code, press `F5`, and open a replay in the Extension Development Host.

Read [Quickstart](docs/QUICKSTART.md), then follow the [worked M228828 workflow](docs/EXAMPLE_WORKFLOW.md). The [team workflow](docs/TEAM_WORKFLOW.md) explains how to review and merge sidecars.

## Agent and CLI workflow

```sh
pnpm cli summary examples/M228828/M228828.replay
pnpm cli detect examples/M228828/M228828.replay
pnpm cli validate examples/M228828/M228828.replay.research.json
```

Codex can follow [`skills/analyze-battlecode-replay/SKILL.md`](skills/analyze-battlecode-replay/SKILL.md). The full reasoning protocol is in [AI analysis guide](docs/AI_ANALYSIS.md), and the portable sidecar contract is defined by [the JSON Schema](schemas/replay-research.schema.json).

## Repository layout

```text
src/            extension host, sidecar model, detector, CLI
webview/        interactive Svelte replay research UI
schemas/        portable research JSON schema
skills/         reusable Codex analysis workflow
docs/           teammate and analysis guides
examples/       M228828 replay plus reviewed detector output
vendor/unswbc/  pinned organiser source as a Git submodule
```

## Current scope

The MVP is VS Code-only and runs AI analysis externally through Codex/the CLI; it does not embed a model or API key. Exact-payload sonar sequences are implemented. Payload-field inference, multi-message protocol mining, spatial clustering, anomaly ranking, comparison across many matches, and a browser build are follow-up work.

## Development

```sh
pnpm test
pnpm check
pnpm build
pnpm package
```

For a browser-based UI smoke harness, run `pnpm dev:webview` and open
`http://127.0.0.1:5173/tests/ui-harness.html`. It mocks the VS Code message
bridge and loads the checked-in `M228828` replay and sidecar.

The studio is MIT licensed. The vendored organiser repository remains under its own MIT license; see [third-party notices](THIRD_PARTY_NOTICES.md).
