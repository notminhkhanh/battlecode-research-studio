import { describe, expect, it } from "vitest";
import {
  mergeResearchDocuments,
  newAnnotation,
  newResearchDocument,
  validateResearchDocument,
  type ReplayIdentity,
} from "../src/research";

const replay: ReplayIdentity = {
  sha256: "a".repeat(64),
  filename: "example.replay",
  formatVersion: 2,
  mapName: "Example",
  rounds: 20,
};

describe("research document", () => {
  it("creates a valid empty document", () => {
    expect(validateResearchDocument(newResearchDocument(replay, "2026-09-27T00:00:00.000Z"))).toEqual([]);
  });

  it("requires timed annotations to have an anchor", () => {
    const document = newResearchDocument(replay, "2026-09-27T00:00:00.000Z");
    const annotation = newAnnotation("point", "tester", undefined, "2026-09-27T00:00:00.000Z");
    document.annotations.push(annotation);
    expect(validateResearchDocument(document)).toContain("annotations[0].start is required for timed annotations.");
  });

  it("merges independently created annotations and keeps the latest edit", () => {
    const base = newResearchDocument(replay, "2026-09-27T00:00:00.000Z");
    const first = newAnnotation("general", "one", undefined, "2026-09-27T00:00:00.000Z");
    first.id = "shared";
    first.title = "old";
    base.annotations = [first];

    const incoming = structuredClone(base);
    incoming.annotations[0].title = "new";
    incoming.annotations[0].provenance.updatedAt = "2026-09-27T01:00:00.000Z";
    const separate = newAnnotation("point", "two", { round: 3 }, "2026-09-27T00:30:00.000Z");
    incoming.annotations.push(separate);

    const merged = mergeResearchDocuments(base, incoming);
    expect(merged.annotations).toHaveLength(2);
    expect(merged.annotations.find((annotation) => annotation.id === "shared")?.title).toBe("new");
  });
});
