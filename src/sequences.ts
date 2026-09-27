import type { GameEvent, LoadedReplay, TeamId, Vector } from "@battledragon/visualiser";
import type { ResearchAnnotation, SequenceStep } from "./research";

export interface ActionOccurrence {
  eventIndex: number;
  round: number;
  dragonId: number;
  label: string;
}

export interface SonarOccurrence {
  eventIndex: number;
  round: number;
  senderId: number;
  senderTeam?: TeamId;
  receiverId: number;
  receiverTeam?: TeamId;
  relationship: "ally" | "enemy" | "self";
  payload: string;
  payloadHex: string;
  direction: string;
  hitKind?: string;
  origin: Vector;
  end: Vector;
  nextAction?: ActionOccurrence;
}

export interface SequenceCandidate {
  id: string;
  senderId: number;
  receiverId: number;
  team?: TeamId;
  relationship: SonarOccurrence["relationship"];
  payload: string;
  payloadHex: string;
  response: string;
  responseConsistency: number;
  confidence: number;
  occurrences: SonarOccurrence[];
}

function actionLabel(event: Extract<GameEvent, { type: "dragonAction" }>): string {
  const action = event.action;
  if (!action) return "NO_ACTION";
  if (action.kind === "move") return `MOVE ${action.steps.join("")}`;
  if (action.kind === "split") return `SPLIT ${action.childSegmentCount}`;
  return "SUICIDE";
}

function responseFamily(label: string): string {
  if (label.startsWith("MOVE ")) return label;
  if (label.startsWith("SPLIT ")) return "SPLIT";
  return label;
}

function lowerBoundAfter(actions: ActionOccurrence[], eventIndex: number): ActionOccurrence | undefined {
  let lo = 0;
  let hi = actions.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (actions[mid].eventIndex <= eventIndex) lo = mid + 1;
    else hi = mid;
  }
  return actions[lo];
}

function payloadHex(payload: bigint): string {
  return `0x${payload.toString(16).padStart(16, "0")}`;
}

function candidateId(senderId: number, receiverId: number, payload: string): string {
  return `sonar-${senderId}-${receiverId}-${BigInt(payload).toString(16).padStart(16, "0")}`;
}

/**
 * Link each delivered sonar to the receiver's next recorded action. This is a
 * temporal relationship only; callers must not describe it as causation.
 */
export function extractSonarOccurrences(replay: LoadedReplay): SonarOccurrence[] {
  const teams = new Map<number, TeamId>();
  for (const dragon of replay.match.roundAt(0).bodies.dragons.values()) teams.set(dragon.id, dragon.team);
  for (const event of replay.events) if (event.type === "dragonSplit") teams.set(event.childId, event.team);

  const actions = new Map<number, ActionOccurrence[]>();
  let round = -1;
  replay.events.forEach((event, eventIndex) => {
    if (event.type === "roundStart") round = event.round;
    if (event.type !== "dragonAction") return;
    const occurrence = { eventIndex, round, dragonId: event.id, label: actionLabel(event) };
    const list = actions.get(event.id) ?? [];
    list.push(occurrence);
    actions.set(event.id, list);
  });

  const occurrences: SonarOccurrence[] = [];
  round = -1;
  replay.events.forEach((event, eventIndex) => {
    if (event.type === "roundStart") round = event.round;
    if (event.type !== "sonarPing" || event.hitId === undefined) return;
    const senderTeam = teams.get(event.senderId);
    const receiverTeam = teams.get(event.hitId);
    const relationship =
      event.senderId === event.hitId ? "self" : senderTeam !== undefined && senderTeam === receiverTeam ? "ally" : "enemy";
    const nextAction = lowerBoundAfter(actions.get(event.hitId) ?? [], eventIndex);
    occurrences.push({
      eventIndex,
      round,
      senderId: event.senderId,
      senderTeam,
      receiverId: event.hitId,
      receiverTeam,
      relationship,
      payload: event.value.toString(),
      payloadHex: payloadHex(event.value),
      direction: event.direction,
      hitKind: event.hitKind,
      origin: event.origin,
      end: event.end,
      // A response several rounds later is too weak to call an immediate chain.
      nextAction: nextAction && nextAction.round <= round + 1 ? nextAction : undefined,
    });
  });
  return occurrences;
}

/** Find repeated exact payloads sent between the same pair with a consistent immediate response. */
export function detectSequenceCandidates(replay: LoadedReplay, minimumOccurrences = 3): SequenceCandidate[] {
  const grouped = new Map<string, SonarOccurrence[]>();
  for (const occurrence of extractSonarOccurrences(replay)) {
    if (occurrence.relationship !== "ally" || !occurrence.nextAction) continue;
    const key = `${occurrence.senderId}:${occurrence.receiverId}:${occurrence.payload}`;
    const group = grouped.get(key) ?? [];
    group.push(occurrence);
    grouped.set(key, group);
  }

  const candidates: SequenceCandidate[] = [];
  for (const rawOccurrences of grouped.values()) {
    // Several identical pings can precede one receiver turn. Count that
    // receiver action once so a burst cannot masquerade as repetition.
    const seenResponses = new Set<number>();
    const occurrences = rawOccurrences.filter((occurrence) => {
      const response = occurrence.nextAction!.eventIndex;
      if (seenResponses.has(response)) return false;
      seenResponses.add(response);
      return true;
    });
    if (occurrences.length < minimumOccurrences) continue;
    const counts = new Map<string, number>();
    for (const occurrence of occurrences) {
      const family = responseFamily(occurrence.nextAction!.label);
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    const [response, matching] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const consistency = matching / occurrences.length;
    if (consistency < 0.75) continue;
    const first = occurrences[0];
    const repetition = Math.min(1, (occurrences.length - 1) / 5);
    const confidence = Math.round((0.35 + 0.4 * consistency + 0.15 * repetition) * 100) / 100;
    candidates.push({
      id: candidateId(first.senderId, first.receiverId, first.payload),
      senderId: first.senderId,
      receiverId: first.receiverId,
      team: first.senderTeam,
      relationship: first.relationship,
      payload: first.payload,
      payloadHex: first.payloadHex,
      response,
      responseConsistency: consistency,
      confidence,
      occurrences,
    });
  }
  return candidates.sort(
    (a, b) => b.confidence - a.confidence || b.occurrences.length - a.occurrences.length || a.id.localeCompare(b.id),
  );
}

export function sequenceCandidateToAnnotation(
  candidate: SequenceCandidate,
  author = "battlecode-sequence-detector",
  now = new Date().toISOString(),
): ResearchAnnotation {
  const first = candidate.occurrences[0];
  const last = candidate.occurrences[candidate.occurrences.length - 1];
  const steps: SequenceStep[] = candidate.occurrences.flatMap((occurrence) => [
    {
      anchor: { round: occurrence.round, eventIndex: occurrence.eventIndex },
      label: `#${occurrence.senderId} sent ${occurrence.payloadHex} to #${occurrence.receiverId}`,
      eventType: "sonarPing",
      team: occurrence.senderTeam,
      dragonIds: [occurrence.senderId, occurrence.receiverId],
      payload: occurrence.payload,
    },
    ...(occurrence.nextAction
      ? [
          {
            anchor: { round: occurrence.nextAction.round, eventIndex: occurrence.nextAction.eventIndex },
            label: `#${occurrence.receiverId} next chose ${occurrence.nextAction.label}`,
            eventType: "dragonAction",
            team: occurrence.receiverTeam,
            dragonIds: [occurrence.receiverId],
          } satisfies SequenceStep,
        ]
      : []),
  ]);
  const rounds = candidate.occurrences.map((occurrence) => occurrence.round);
  const percentage = Math.round(candidate.responseConsistency * 100);
  return {
    id: candidate.id,
    kind: "sequence",
    title: `Repeated sonar #${candidate.senderId} → #${candidate.receiverId} before ${candidate.response}`,
    start: { round: first.round, eventIndex: first.eventIndex },
    end: {
      round: last.nextAction?.round ?? last.round,
      eventIndex: last.nextAction?.eventIndex ?? last.eventIndex,
    },
    observation: `${candidate.payloadHex} was delivered ${candidate.occurrences.length} times from #${candidate.senderId} to #${candidate.receiverId}; ${percentage}% were followed by ${candidate.response}.`,
    hypothesis: "The payload may encode a direction, target, role, or task that influences the receiver's next action.",
    alternatives: [
      "The receiver may already have been following the same route independently.",
      "The payload may report state rather than instruct an action.",
      "A shared deterministic policy may explain both the payload and the response.",
    ],
    confidence: candidate.confidence,
    status: "candidate",
    teams: candidate.team ? [candidate.team] : undefined,
    dragonIds: [candidate.senderId, candidate.receiverId],
    steps,
    evidence: [
      {
        description: "Repeated delivery rounds",
        eventIndices: candidate.occurrences.map((occurrence) => occurrence.eventIndex),
        rounds,
      },
      { description: "Response consistency", metric: "matching_next_action_ratio", value: candidate.responseConsistency },
    ],
    provenance: {
      source: "detector",
      author,
      detector: "exact-sonar-response-v1",
      createdAt: now,
      updatedAt: now,
    },
  };
}
