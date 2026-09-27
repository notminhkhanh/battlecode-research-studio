# Research annotation contract

Read this before creating or updating annotations. The canonical machine contract is `schemas/replay-research.schema.json`; this reference explains how to derive the fields from replay evidence.

## Identity and time bounds

- Preserve an existing annotation `id` when revising it. Give a new finding a stable, unique ID.
- `point` has `start`; `range` and `sequence` have both `start` and `end`; `general` has neither.
- An anchor's `round` is the replay round containing the cited event. `eventIndex` is the event's zero-based index in the complete ordered replay stream when known.
- For a range or sequence, `start` is the first relevant evidence and `end` is the last relevant evidence. Keep `end.round >= start.round`.
- These anchors are saved evidence bounds. The UI seeks to `start` and auto-pauses at `end`; never replace them with the viewer's incidental current round.

## Interested dragons

`dragonIds` is the unique list of dragons central to the whole annotation. Selecting the annotation feeds these IDs into the original viewer's pinned metadata, vision, follow, and Game Log filtering.

Derive IDs from actual replay actors:

- sonar sender: `sonarPing.senderId`;
- sonar receiver: `sonarPing.hitId` only when the hit is a dragon;
- response actor: the ID on the cited action, normally the actual receiver being followed;
- split relationship: include the parent and child when both are material to the finding;
- movement, death, pearl, or role findings: include only the focal dragons whose behaviour is discussed.

Do not add every nearby dragon, an intended sonar target that was not actually hit, tile/portal IDs, or a child before its split. Keep IDs unique and order them by first meaningful appearance (for example sender, then receiver).

For a `sequence`, each ordered `step` has its own `dragonIds` containing only the actors in that step. A send step normally references sender and actual receiver; the response step normally references the responder. The annotation-level `dragonIds` is the unique union of its focal step actors. Set `teams` from the tracked team membership of those actors.

## Reasoning and review metadata

- `observation`: directly visible facts, counts, rounds, and measured consistency.
- `hypothesis`: the strategic interpretation, phrased as a testable possibility.
- `alternatives`: credible competing or non-causal explanations.
- `confidence`: claim strength from 0 to 1, not visual importance.
- `status`: normally `candidate` for new agent findings; use `needs-evidence`, `confirmed`, or `rejected` only when the evidence supports that review state.
- `evidence`: reproducible event indices, rounds, metrics, and short descriptions.
- `steps`: an ordered event chain with `anchor`, neutral `label`, and, when known, `eventType`, `team`, `dragonIds`, and lossless decimal-string sonar `payload`.
- `provenance`: use source `agent` for agent-created findings, identify the author/method, and set ISO-8601 `createdAt`/`updatedAt`. Preserve `createdAt` when editing.

The annotation format does not include tags or map highlights. Put useful searchable concepts in the neutral title and evidence text, and represent interested dragons with `dragonIds`.
