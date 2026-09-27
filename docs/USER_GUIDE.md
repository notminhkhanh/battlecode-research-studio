# User guide

This guide is for teammates who want to inspect replays, review AI findings, and share research. You do not need to understand or modify the extension source.

## The two files

Battlecode Research Studio works with two separate files:

- `match.replay` is the original game replay. The extension only reads it.
- `match.replay.research.json` is the research sidecar containing annotations and AI findings.

Keeping research in a sidecar means teammates can share and review notes without rewriting the replay. A sidecar records the replay's SHA-256 hash, so the extension can warn when it is paired with different replay bytes.

## Install a shared VSIX

1. Get the newest `battlecode-research-studio-*.vsix` from a teammate.
2. In VS Code, open the Command Palette with `Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on Windows/Linux.
3. Run **Extensions: Install from VSIX…** and select the file.
4. Reload VS Code when prompted.
5. After an update, install the newer VSIX the same way. VS Code replaces the installed version.

To build it yourself instead, clone the repository with submodules and follow [Build from source](#build-from-source).

## Open a replay

1. In VS Code, choose **File → Open File…** and select a `.replay` file.
2. If another editor opens it, right-click the editor tab, choose **Reopen Editor With…**, then select **Battlecode Research Replay**.
3. Use the original viewer normally: play or seek the replay, hover for metadata, and left-click a dragon to use its native selection card, vision display, following, and Game Log filters.
4. Open the additional **Research** tab to work with annotations.

When `match.replay.research.json` is beside `match.replay`, it loads automatically. Otherwise, the extension starts an empty research document for that replay.

## Review an annotation

The annotation list has a fixed height and scrolls independently. The detail panel below it stays empty until you select an item.

Selecting an annotation:

- opens its details in read-only mode;
- selects its referenced dragon IDs using the original viewer;
- seeks to its saved start round when it has one; and
- arms automatic pausing at the saved end round for ranges and sequences.

Press Play after selecting a range or sequence. Playback stops at its end round. Selecting a sequence step jumps to that step and selects only the dragons involved in that step.

The viewer selection is temporary. Merely playing, seeking, or selecting dragons does not change the annotation's saved start, end, or dragon IDs.

## Create an annotation

First seek to the relevant round and, if useful, select the involved dragons in the original viewer. Then choose:

- **+ Point** for one interesting moment;
- **+ Range** for a phase with a start and end;
- **+ General** for a replay-wide conclusion with no time anchor.

The new item opens in edit mode. Complete the fields that help another reviewer reproduce your reasoning:

- **Title:** a short, neutral description.
- **Status:** `candidate`, `needs-evidence`, `confirmed`, or `rejected`.
- **Confidence:** a value from 0 to 1 when useful.
- **Start/end round:** stable bounds for the evidence. A range initially uses the current round for both.
- **Referenced dragon IDs:** the focal dragons, not every nearby dragon.
- **Observed evidence:** facts directly visible in the replay.
- **Hypothesis:** the strategy that might explain those facts.
- **Alternatives:** one competing explanation per line.

Use **Use currently selected dragons** to copy the viewer's current selection into the draft. Choose **Save annotation** to commit the draft and write the sidecar immediately. **Cancel** discards the draft and restores the last saved values.

Existing annotations are read-only until you choose **Edit**. This prevents ordinary replay navigation from accidentally changing evidence bounds.

## Review detected communication sequences

Expand **Detected sequences** to see automatic leads from the current replay. The built-in detector looks for the same sender delivering the same 64-bit sonar value to the same allied receiver at least three times, followed by a sufficiently consistent receiver action.

Click a candidate to add it to the annotation list. Then:

1. select it from the annotation list;
2. play its saved range and inspect each **Sequence evidence** step;
3. use the selected dragons' native metadata, vision, and Game Log filters;
4. separate what happened from why you think it happened; and
5. choose **Edit** to revise its status, evidence, hypothesis, or alternatives.

A detected sequence is a lead, not proof that a payload means a particular command. After adding a detector candidate, use the top-level **Save** button to persist it if you have not edited and saved it.

## Save, open, and share research

- **Save annotation** commits the current edit and writes the active sidecar.
- Top-level **Save** writes other document changes, such as adding a detected candidate or deleting an annotation.
- **Save as…** writes the research document to a location you choose and makes that file the active sidecar for the current editor.
- **Open bookmark file…** loads an existing `.json` sidecar. It does not alter the replay.

The normal adjacent filename is exactly:

```text
M228828.replay
M228828.replay.research.json
```

Share both files, or share only the sidecar when your teammate already has the exact replay. If the extension warns that the sidecar belongs to different replay bytes, stop and compare replay files rather than saving over the warning.

## Annotation statuses

- `candidate`: interesting and not yet verified.
- `needs-evidence`: worth keeping, but a specific follow-up or control is missing.
- `confirmed`: reviewed evidence supports the claim at the stated confidence.
- `rejected`: disproved or misleading, retained so the team does not repeat the same inference.

## Suggested teammate review loop

1. The scout runs AI/CLI analysis and shares the replay plus sidecar.
2. The verifier selects each finding, watches its complete range, and checks the cited sequence steps.
3. The skeptic adds alternative explanations and negative controls.
4. The team updates statuses and saves the sidecar.
5. The experimenter turns the strongest finding into a test in the separate bot repository.

Commit the sidecar before handing it to the next reviewer. Pull the newest version before editing; see [Team workflow](TEAM_WORKFLOW.md) for merge guidance.

## Build from source

Building requires Git, Node.js 20+, pnpm, and VS Code 1.90+.

```sh
git clone --recurse-submodules git@github.com:notminhkhanh/battlecode-research-studio.git
cd battlecode-research-studio
pnpm install
pnpm package
```

Install the generated `battlecode-research-studio-*.vsix` with **Extensions: Install from VSIX…**. For extension development, open the repository in VS Code and press `F5`.

## Troubleshooting

### The replay opens as text or with another extension

Use **Reopen Editor With… → Battlecode Research Replay**. Confirm Battlecode Research Studio is installed and enabled for the current VS Code profile.

### No annotations appear

Open the **Research** tab. If the sidecar is not next to the replay with the exact adjacent filename, choose **Open bookmark file…** and select it manually.

### My edit disappeared

Choose **Save annotation** before selecting another item. **Cancel** deliberately discards the draft. For detector additions and deletions, use top-level **Save**.

### A sidecar will not open

The file must match the current JSON schema. Run `pnpm cli validate path/to/file.research.json` from a source checkout for the exact validation error. Old experimental sidecars should be regenerated rather than migrated.

### The sidecar/replay warning appears

The sidecar's stored SHA-256 differs from the open replay. Obtain the exact replay used by the annotator; do not change the stored identity merely to suppress the warning.
