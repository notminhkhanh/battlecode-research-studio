#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { buildReplay, type LoadedReplay } from "../vendor/unswbc/packages/visualiser/src/replay/loader";
import { REPLAY_FORMAT_VERSION } from "../vendor/unswbc/packages/visualiser/src/replay/generated/replay";
import type { GameEvent } from "../vendor/unswbc/packages/visualiser/src/visualiser/Schema";
import { newResearchDocument, parseResearchDocument, type ReplayIdentity } from "./research";
import { detectSequenceCandidates, extractSonarOccurrences, sequenceCandidateToAnnotation } from "./sequences";

function usage(): never {
  console.error(`Battlecode Research Studio CLI

Usage:
  pnpm cli summary <replay>
  pnpm cli detect <replay> [--out <sidecar>]
  pnpm cli validate <sidecar>

The default detect output is <replay>.research.json.`);
  process.exit(2);
}

function argument(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function eventCounts(events: GameEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function replayIdentity(path: string, bytes: Uint8Array, loaded: LoadedReplay): ReplayIdentity {
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    filename: basename(path),
    formatVersion: REPLAY_FORMAT_VERSION,
    mapName: loaded.match.roundAt(0).map.staticMap.mapName || undefined,
    rounds: loaded.match.maxRound,
  };
}

async function openReplay(path: string) {
  const bytes = await readFile(path);
  const loaded = buildReplay(bytes);
  return { bytes, loaded, identity: replayIdentity(path, bytes, loaded) };
}

async function summary(path: string): Promise<void> {
  const { bytes, loaded, identity } = await openReplay(path);
  const sonar = extractSonarOccurrences(loaded);
  const candidates = detectSequenceCandidates(loaded);
  console.log(
    JSON.stringify(
      {
        replay: identity,
        bytes: bytes.byteLength,
        teams: loaded.teams,
        result: loaded.result,
        events: eventCounts(loaded.events),
        sonar: {
          totalDelivered: sonar.length,
          ally: sonar.filter((item) => item.relationship === "ally").length,
          enemy: sonar.filter((item) => item.relationship === "enemy").length,
          self: sonar.filter((item) => item.relationship === "self").length,
        },
        sequenceCandidates: candidates.slice(0, 25).map((candidate) => ({
          id: candidate.id,
          senderId: candidate.senderId,
          receiverId: candidate.receiverId,
          team: candidate.team,
          payloadHex: candidate.payloadHex,
          response: candidate.response,
          occurrences: candidate.occurrences.length,
          rounds: candidate.occurrences.map((item) => item.round),
          responseConsistency: candidate.responseConsistency,
          confidence: candidate.confidence,
        })),
      },
      null,
      2,
    ),
  );
}

async function detect(path: string): Promise<void> {
  const { loaded, identity } = await openReplay(path);
  const output = argument("--out") ?? `${path}.research.json`;
  const document = newResearchDocument(identity);
  document.title = `${identity.mapName ?? identity.filename} research`;
  document.summary = "Initial machine-generated candidates. Review each observation and hypothesis in the visualiser.";
  document.annotations = detectSequenceCandidates(loaded).map((candidate) => sequenceCandidateToAnnotation(candidate));
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`Wrote ${document.annotations.length} candidates to ${output}`);
}

async function validate(path: string): Promise<void> {
  const document = parseResearchDocument(await readFile(path, "utf8"));
  console.log(`Valid schema v${document.schemaVersion}: ${document.annotations.length} annotations for ${document.replay.filename}`);
}

const [command, path] = process.argv.slice(2);
if (!command || !path) usage();

try {
  if (command === "summary") await summary(path);
  else if (command === "detect") await detect(path);
  else if (command === "validate") await validate(path);
  else usage();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
