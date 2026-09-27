# Quickstart

## Install the extension

1. Get the newest `battlecode-research-studio-*.vsix` from the team.
2. In VS Code, run **Extensions: Install from VSIX…** and choose that file.
3. Reload VS Code when prompted.

That is enough for normal use; Node.js, pnpm, and the source repository are only needed to build or develop the extension. When the extension is updated, install the newer VSIX the same way.

## Open and annotate a replay

1. Open a `.replay` file. Battlecode Research Studio is the default custom editor.
   If another editor opens it, use **Reopen Editor With… → Battlecode Research Replay**.
2. The original **Info**, **Game Log**, and **Options** tabs and all original board interactions are unchanged. Open the additional **Research** tab for bookmarks.
3. Use the original playback controls to seek by round, turn, or event. Left-click dragon heads to select the dragons involved; this opens their native metadata cards, vision, and Game Log filters.
4. At an interesting moment, choose **+ Point** or **+ Range**. The new bookmark records the current round and selected dragon IDs, then opens an edit draft. For a range, enter its start/end rounds directly or use the current replay round for either anchor. Use **+ General** for a replay-wide note.
5. Choose **Save annotation** to commit the draft and write the bookmark file. **Cancel** discards draft changes, so saved start/end rounds remain constant while viewing or playing the replay.
6. Existing annotations open read-only. Choose **Edit** before changing the title, anchors, dragons, evidence, hypothesis, alternatives, confidence, or status.
7. Selecting a range or sequence seeks to its saved start. Press Play and the viewer automatically pauses when it reaches the saved end round.
8. `candidate` means interesting but unverified; `needs-evidence` asks for a follow-up; `confirmed` means the team has reviewed enough evidence; `rejected` preserves a disproved lead.
9. The top-level **Save** writes any other document changes. The default file is `<replay>.research.json` beside the replay.

To use a bookmark file someone sent you, open the replay, go to **Research**, and choose **Open bookmark file…**. Selecting a bookmark seeks to its start and restores its referenced dragon IDs through the original viewer. Use **Use currently selected dragons** if you want to replace a bookmark's references with the dragons you selected manually.

Saving does not modify the replay. The sidecar records the replay SHA-256 and the studio warns if the JSON is opened with different replay bytes.

For field explanations, sharing instructions, and troubleshooting, read the full [User guide](USER_GUIDE.md).

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
