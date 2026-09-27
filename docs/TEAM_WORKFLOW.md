# Team workflow

## Recommended loop

1. One teammate adds a replay to a private/shared location and runs the detector.
2. Commit the replay only when you have the right to share it within this repository. Always commit the much smaller `.research.json` sidecar.
3. Each reviewer opens the same replay bytes, selects candidates from the fixed Research list, and reviews the saved start-to-end interval. Annotation details are read-only until the reviewer chooses **Edit**; **Save annotation** commits the draft and writes the sidecar, while **Cancel** preserves the previous values.
4. Review important claims together. Promote them from `candidate` to `confirmed`, mark missing tests as `needs-evidence`, or retain failed ideas as `rejected`.
5. Turn confirmed patterns into a concrete experiment against your own bot.

## Avoiding merge pain

Annotations have stable IDs, so edits to different annotations usually merge cleanly. Before editing, pull the latest sidecar. Keep one conceptual finding per annotation instead of creating one large note. If Git reports a conflict, do not choose an entire file blindly:

- preserve both annotations when their IDs differ;
- for the same ID, keep the version with the later `provenance.updatedAt`, then manually include any useful text from the other version;
- never change the replay identity to silence a hash warning—verify that everyone has the same replay file.

The library exposes `mergeResearchDocuments` for a future automatic merge command. The MVP keeps Git review visible rather than silently resolving concurrent interpretations.

## Suggested review roles

- **Scout:** runs automated analysis and records candidates.
- **Verifier:** watches each cited round/event and corrects factual mistakes.
- **Skeptic:** writes alternative explanations and checks selection bias.
- **Experimenter:** turns the strongest claim into a bot or simulation test.

One person can take several roles, but explicitly switching roles improves the quality of strategy inference.

## Sharing with a teammate

For normal use, send the teammate the current VSIX and give them access to the private location containing the replay and sidecar. They install the VSIX, open the exact replay, and either let the adjacent sidecar load automatically or choose **Open bookmark file…**. They only need to clone with submodules and build the project if they are contributing extension code.

The extension has no account, server, API key, or hosted database. Git or another private shared location is the collaboration layer. See the [User guide](USER_GUIDE.md) for installation, UI behavior, persistence rules, and troubleshooting.
