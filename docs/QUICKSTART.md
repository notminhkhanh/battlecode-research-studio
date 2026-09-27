# Quickstart

## Install the extension

1. Clone the private repository with `--recurse-submodules`.
2. Run `pnpm install` and `pnpm package`.
3. In VS Code, run **Extensions: Install from VSIX…** and choose `battlecode-research-studio-0.1.0.vsix`.
4. Give your teammate repository access; they follow the same three steps.

When the extension is updated, pull with submodules, rebuild the VSIX, and reinstall it. During active development, pressing `F5` is faster.

## Open and annotate a replay

1. Open a `.replay` file. Battlecode Research Studio is the default custom editor.
2. Use the original playback controls to seek by round, turn, or event.
3. At an interesting moment, choose **+ Point**. Use **+ Range**, seek forward, and choose **Set end** for a time span. Use **+ General** for a replay-wide note.
4. Write the direct observation first. Put interpretation in **Hypothesis**, and list plausible competing explanations separately.
5. Choose **Highlight map cells**, then click relevant cells on the board. Click a selected cell again to remove it.
6. Set confidence and status. `candidate` means interesting but unverified; `needs-evidence` asks for a follow-up; `confirmed` means the team has reviewed enough evidence; `rejected` preserves a disproved lead.
7. Choose **Save sidecar**. The default file is `<replay>.research.json` beside the replay.

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

The second command creates `path/to/match.replay.research.json`. Open the replay in VS Code, review the candidates, edit the sidecar, and save.
