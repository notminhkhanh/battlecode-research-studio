# Quickstart

## Install the extension

1. Clone the private repository with `--recurse-submodules`.
2. Run `pnpm install` and `pnpm package`.
3. In VS Code, run **Extensions: Install from VSIX…** and choose `battlecode-research-studio-0.1.0.vsix`.
4. Give your teammate repository access; they follow the same three steps.

When the extension is updated, pull with submodules, rebuild the VSIX, and reinstall it. During active development, pressing `F5` is faster.

## Open and annotate a replay

1. Open a `.replay` file. Battlecode Research Studio is the default custom editor.
2. The original **Info**, **Game Log**, and **Options** tabs and all original board interactions are unchanged. Open the additional **Research** tab for bookmarks.
3. Use the original playback controls to seek by round, turn, or event. Left-click dragon heads to select the dragons involved; this opens their native metadata cards, vision, and Game Log filters.
4. At an interesting moment, choose **+ Point**. The new bookmark records the currently selected dragon IDs. Use **+ Range**, seek forward, and choose **Set end** for a time span. Use **+ General** for a replay-wide note.
5. Write the direct observation first. Put interpretation in **Hypothesis**, and list plausible competing explanations separately.
6. Set confidence and status. `candidate` means interesting but unverified; `needs-evidence` asks for a follow-up; `confirmed` means the team has reviewed enough evidence; `rejected` preserves a disproved lead.
7. Choose **Save**. The default file is `<replay>.research.json` beside the replay.

To use a bookmark file someone sent you, open the replay, go to **Research**, and choose **Open bookmark file…**. Selecting a bookmark seeks to its start and restores its referenced dragon IDs through the original viewer. Use **Use currently selected dragons** if you want to replace a bookmark's references with the dragons you selected manually.

Saving does not modify the replay. The sidecar records the replay SHA-256 and the studio warns if the JSON is opened with different replay bytes.

## Review detected sonar sequences

Open **Detected sequences** in the Research tab. A candidate means:

- the same sender delivered the same 64-bit value to the same allied receiver at least three times; and
- the receiver's next recorded action, no later than the next round, matched at least 75% of the time.

Click a candidate to add it to the sidecar. Its evidence steps are navigable. Treat the generated explanation as a starting hypothesis, not a protocol decode.

## Run the agent-oriented detector

From the repository root:

```sh
pnpm cli summary path/to/match.replay
pnpm cli detect path/to/match.replay
```

The second command creates `path/to/match.replay.research.json`. Open the replay in VS Code; if the file is not adjacent to the replay, load it with **Research → Open bookmark file…**. Review the candidates, edit the sidecar, and save.
