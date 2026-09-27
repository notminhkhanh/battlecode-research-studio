# AI replay analysis guide

This guide tells an AI agent how to produce useful, auditable Battlecode research rather than an impressive-sounding story.

## Output contract

Write `<replay>.research.json` conforming to `schemas/replay-research.schema.json`. Bind it to the exact replay using filename, SHA-256, format version, map name, and round count. Preserve existing human annotations and stable IDs. Validate the result with:

```sh
pnpm cli validate path/to/match.replay.research.json
```

## Evidence hierarchy

For every finding, keep these layers distinct:

1. **Observation:** replay facts—sender, actual hit/receiver, payload, round/event index, positions, action, split, death, or pearl change.
2. **Pattern:** repetition or contrast measured across comparable events.
3. **Hypothesis:** a strategic or protocol interpretation that could explain the pattern.
4. **Alternatives:** at least one non-causal or competing explanation.
5. **Test:** evidence that would increase or decrease confidence.

Do not phrase temporal adjacency as causation. The replay records actual sender and hit target, but a dragon's bot receives the sonar value through game mechanics; the public replay does not prove how its code interpreted that value. Sanitised public replays may also omit opponent logs, indicators, debug drawings, bot name, and instruction counts.

## Analysis procedure

### 1. Establish the match shape

Run `pnpm cli summary <replay>`. Record map, duration, result, team populations, splits, deaths, actions, and sonar volume. Find phases such as opening expansion, first contact, consolidation, and elimination.

### 2. Build entity histories

Track every dragon ID, team, birth/split, body/head position, action, sonar sent, sonar received, and death. A child ID begins at a split; do not project its later team or role backward before birth.

### 3. Trace communication chains

Start with exact repeated `(sender, receiver, payload)` groups. Count a receiver action only once even if a burst contains duplicate pings, then inspect:

- receiver's next action and next several rounds of movement;
- other messages immediately before and after;
- whether the same payload reaches different dragons;
- whether changed payload fields correlate with direction, position, role, target, or phase;
- whether a response also occurs without the message;
- whether the sender and receiver were already following a deterministic route.

Represent meaningful chains as `sequence` annotations with ordered `steps`, not just a wide time range. Cite event indices and rounds in `evidence`.

Treat `start` and `end` as stable evidence bounds. Set `start` to the first relevant event and `end` to the last relevant event, with `end >= start`. The Research UI seeks to `start` when the annotation is selected and pauses playback at `end`; do not rewrite either anchor from incidental viewer playback state.

Populate `dragonIds` with the unique focal dragons derived from actual replay actors—not every nearby dragon. For sonar, use the recorded sender and the actual dragon hit; for a response step, use the actor whose response is cited. Sequence-step `dragonIds` should contain only that step's actors, while annotation-level `dragonIds` is the focal union used by the viewer's native pinned cards, vision, follow, and Game Log filters. See the skill's `references/annotation-contract.md` for the complete derivation rules.

### 4. Add spatial context

Reference the sender and receiver dragon IDs in the annotation. Check portals, pearl beds, congestion, enemies, and boundaries. A response that looks communicative in time may instead be forced by local geometry.

### 5. Search beyond sonar

Look for repeated split timing and child allocation, route/role changes, coordinated arrival, sacrifice/blocking, pearl harvesting cycles, reactions to enemy contact, and phase transitions. Prefer patterns repeated across multiple agents or rounds.

### 6. Calibrate and prune

Use confidence as a claim-strength estimate, not visual importance:

- `0.2–0.4`: plausible lead, weak controls or one occurrence;
- `0.5–0.7`: repeated association with credible alternatives;
- `0.75–0.9`: strong repeated evidence plus negative controls;
- above `0.9`: reserve for direct protocol evidence or a decisive controlled test.

Mark weak-but-worthwhile findings `needs-evidence`. Keep rejected hypotheses when they teach the team what not to infer.

## Minimum quality bar for a sequence annotation

- A neutral title.
- Exact observation with counts and consistency.
- Stable start/end bounds and ordered evidence steps.
- Sender/actual-receiver dragon IDs at annotation and step level, plus tracked team.
- Payload in decimal (lossless JSON string) and hexadecimal (in labels/observation).
- One hypothesis and at least two alternatives.
- Confidence and review status.
- A proposed next check in the observation, hypothesis, or an evidence entry when appropriate.

## Useful follow-up analyses

The MVP detector is intentionally narrow. An agent can extend the sidecar manually with message burst analysis, payload bit-field comparisons, response windows longer than one action, counterfactual controls, spatial clustering, and cross-replay comparisons. State the method and thresholds in provenance/evidence so teammates can reproduce it.
