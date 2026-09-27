import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildReplay } from "../vendor/unswbc/packages/visualiser/src/replay/loader";
import { describe, expect, it } from "vitest";
import { detectSequenceCandidates, sequenceCandidateToAnnotation } from "../src/sequences";

const replayPath = fileURLToPath(new URL("../examples/M228828/M228828.replay", import.meta.url));

describe("sonar sequence detection", () => {
  const replay = buildReplay(readFileSync(replayPath));
  const candidates = detectSequenceCandidates(replay);

  it("finds repeated exact-payload response chains in M228828", () => {
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(new Set(candidate.occurrences.map((item) => item.nextAction?.eventIndex)).size).toBe(
        candidate.occurrences.length,
      );
    }
    const south = candidates.find(
      (candidate) =>
        candidate.senderId === 27 &&
        candidate.receiverId === 34 &&
        candidate.payloadHex === "0xb68400334d08d04c",
    );
    expect(south?.occurrences.map((occurrence) => occurrence.round)).toEqual([59, 63, 79]);
    expect(south?.response).toBe("MOVE S");
    expect(south?.responseConsistency).toBe(1);
  });

  it("turns a candidate into evidence-backed research data", () => {
    const candidate = candidates.find((item) => item.senderId === 27 && item.receiverId === 34);
    expect(candidate).toBeDefined();
    const annotation = sequenceCandidateToAnnotation(candidate!, "test", "2026-09-27T00:00:00.000Z");
    expect(annotation.kind).toBe("sequence");
    expect(annotation.provenance.source).toBe("detector");
    expect(annotation.hypothesis).toContain("may encode");
    expect(annotation.alternatives?.length).toBeGreaterThan(1);
    expect(annotation.steps?.length).toBe(candidate!.occurrences.length * 2);
  });
});
