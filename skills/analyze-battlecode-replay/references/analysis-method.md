# Replay analysis reference

The sidecar schema is `schemas/replay-research.schema.json`; human-readable guidance is in `docs/AI_ANALYSIS.md`.

Key facts:

- Replay events are a flat ordered stream grouped by `roundStart` and `turnStart`.
- `sonarPing` records sender ID, direction, unsigned 64-bit value, ray origin/end, actual hit ID, and hit kind.
- Preserve 64-bit payloads as decimal strings; use zero-padded `0x` hexadecimal for comparison and display.
- “Receiver's next action” is a temporal link. It is not automatically an instruction-response link.
- Child dragon IDs begin at `dragonSplit`; track team membership from initial bodies and split events.
- Public/sanitised battle replays can omit opponent logs, indicators, debug drawings, bot name, and instruction counts. Absence of those fields is not evidence that the bot lacked the state.
- A high-quality claim cites rounds/events, measures repetition, checks no-message or alternate-message controls, proposes alternatives, and explains what evidence would falsify it.

Default detector rule: allied delivery, same sender/receiver/exact payload, at least three distinct receiver actions, receiver action within the same or next round, and at least 75% matching response family. Duplicate pings tied to one response count once. Generated confidence is a ranking heuristic and must be reviewed.
