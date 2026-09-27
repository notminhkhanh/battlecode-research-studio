# Battlecode Research Studio

Battlecode Research Studio is an additive extension of the organiser's VS Code replay viewer for collaborative strategy research. It keeps the original board, playback controls, hover metadata, pinned dragon cards, following, vision, Game Log filters, Info and Options, then adds one Research tab for shareable bookmarks, time ranges, hypotheses, and communication/action sequences.

The repository is private so the included `M228828.replay` and your team's analysis stay within the team.

## MVP features

- Open `*.replay` files directly in VS Code with the official UNSW Battlecode renderer.
- Add general notes, point bookmarks, and round ranges.
- Browse bookmarks in a fixed scrollable list; the detail area remains empty until one is selected.
- View annotations read-only by default; edit them through an explicit draft and **Save annotation** action.
- Selecting a range or sequence seeks to its saved start and pauses playback when its saved end is reached.
- Reference dragons in an annotation using the viewer's native selection system. Selecting the bookmark opens the original pinned cards, vision, and Game Log filters.
- Jump from an annotation or sequence step to its evidence without replacing the normal replay controls.
- Detect repeated exact sonar messages between allies and the receiver's next action.
- Keep observations, hypotheses, alternatives, confidence, and review status separate.
- Open any shared bookmark file from the Research tab. Save beside the replay as `<replay>.research.json`, or use **Save as…**.
- Share the JSON sidecar through Git without duplicating the replay for every edit.

This first detector deliberately finds high-signal leads rather than claiming it decoded another team's protocol. “Message X was followed by MOVE W three times” is an observation; “X orders the receiver west” remains a hypothesis until you test alternatives.

## Get started as a user

Install the latest `battlecode-research-studio-*.vsix` with VS Code's **Extensions: Install from VSIX…** command, then open a `.replay` file. A teammate using a prebuilt VSIX only needs VS Code 1.90+.

Start with the [user guide](docs/USER_GUIDE.md), then follow the [worked M228828 workflow](docs/EXAMPLE_WORKFLOW.md). The [team workflow](docs/TEAM_WORKFLOW.md) explains how to review and merge shared sidecars.

## Build from source

Building requires Node.js 20+, pnpm, and Git with submodule access.

```sh
git clone --recurse-submodules git@github.com:notminhkhanh/battlecode-research-studio.git
cd battlecode-research-studio
pnpm install
pnpm package
```

Install the resulting `.vsix` in VS Code using **Extensions: Install from VSIX…**, then open `examples/M228828/M228828.replay`. The example sidecar is loaded automatically.

For development, open this repository in VS Code, press `F5`, and open a replay in the Extension Development Host.

The shorter [quickstart](docs/QUICKSTART.md) is useful as a checklist after the first installation.

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
docs/           user, teammate, example, and AI-analysis guides
examples/       M228828 replay plus reviewed detector output
vendor/unswbc/  pinned organiser source as a Git submodule
patches/        small additive hooks applied to the pinned organiser UI at build time
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
