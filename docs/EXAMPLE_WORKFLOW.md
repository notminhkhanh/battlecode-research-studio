# Worked example: M228828

The private example pairs `examples/M228828/M228828.replay` with its generated research sidecar. Its SHA-256 is `c49c237a58cc55452b1dee022aa0128573c9341c5a300581c69a64ede6f68b43`.

## 1. Generate the baseline

```sh
pnpm cli summary examples/M228828/M228828.replay
pnpm cli detect examples/M228828/M228828.replay
```

The replay is on the 32×16 map **Devil**, has 171 round-start events, 6,249 actions, 201 splits, 148 deaths, and 24,492 emitted sonar pings. Of 10,871 pings that hit a dragon, 9,482 hit an ally, 767 an enemy, and 622 the sender itself. Team B wins by elimination.

## 2. Open the replay

Open `M228828.replay` in VS Code. The adjacent sidecar loads two detector candidates in the additional **Research** tab. Selecting one seeks to its start and selects dragons #27 and #34 through the original viewer, so their pinned cards, vision, and Game Log filters are available. Use its **Sequence evidence** steps to jump between messages and responses.

## 3. Review one candidate

Candidate `sonar-27-34-b6840030cd3cc04d` observes:

- B dragon #27 delivered `0xb6840030cd3cc04d` to allied dragon #34 in rounds 68, 72, and 76.
- #34's next recorded action was `MOVE W` after all three deliveries.

The safe hypothesis is: “this payload may carry a westward target, direction, task, or state that influences #34.” It is not yet safe to say “#27 ordered #34 west.” #34 could already be on a westward route; both actions may follow shared state; or the payload may only report something correlated with that state.

Now compare candidate `sonar-27-34-b68400334d08d04c`:

- the same sender/receiver pair uses another exact payload in rounds 59, 63, and 79;
- #34 next chooses `MOVE S` each time.

The contrast makes a direction-like field more interesting, but it still needs controls. Inspect how the two 64-bit values differ, whether #34 moves west/south without these messages, and what map targets are visible in those rounds. Record the relevant spatial context as a separate annotation rather than overwriting detector evidence.

## 4. Turn the finding into research

Suggested human follow-up:

1. Mark both candidates `needs-evidence`.
2. Add a point at each no-message west/south movement by #34 as a negative control.
3. Compare nearby payloads sent by #27 to other receivers.
4. Check whether the changing bits align with coordinates, directions, roles, or timestamps.
5. Promote the hypothesis only if it predicts held-out occurrences.

Save the sidecar, commit only your review changes, and ask a teammate to independently verify the cited rounds.
