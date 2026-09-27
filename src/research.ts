export const RESEARCH_SCHEMA_VERSION = 1 as const;

export type AnnotationKind = "general" | "point" | "range" | "sequence";
export type AnnotationStatus = "candidate" | "confirmed" | "rejected" | "needs-evidence";
export type AnnotationSource = "human" | "agent" | "detector";
export type TeamId = "A" | "B";

export interface ReplayIdentity {
  sha256: string;
  filename: string;
  formatVersion: number;
  mapName?: string;
  rounds: number;
}

export interface EventAnchor {
  round: number;
  /** Zero-based index in the replay's complete event stream. */
  eventIndex?: number;
}

export interface SequenceStep {
  anchor: EventAnchor;
  label: string;
  eventType?: string;
  team?: TeamId;
  dragonIds?: number[];
  payload?: string;
}

export type MapHighlight =
  | { kind: "cell"; x: number; y: number; label?: string; color?: string }
  | { kind: "rect"; x: number; y: number; width: number; height: number; label?: string; color?: string }
  | { kind: "path"; points: Array<{ x: number; y: number }>; label?: string; color?: string }
  | { kind: "dragon"; id: number; team?: TeamId; label?: string; color?: string };

export interface EvidenceRef {
  description: string;
  eventIndices?: number[];
  rounds?: number[];
  metric?: string;
  value?: number | string;
}

export interface AnnotationProvenance {
  source: AnnotationSource;
  author: string;
  createdAt: string;
  updatedAt: string;
  detector?: string;
}

export interface ResearchAnnotation {
  id: string;
  kind: AnnotationKind;
  title: string;
  start?: EventAnchor;
  end?: EventAnchor;
  observation: string;
  hypothesis?: string;
  alternatives?: string[];
  confidence?: number;
  status: AnnotationStatus;
  tags: string[];
  teams?: TeamId[];
  dragonIds?: number[];
  steps?: SequenceStep[];
  highlights?: MapHighlight[];
  evidence?: EvidenceRef[];
  provenance: AnnotationProvenance;
}

export interface ResearchDocument {
  schemaVersion: typeof RESEARCH_SCHEMA_VERSION;
  replay: ReplayIdentity;
  title: string;
  summary: string;
  annotations: ResearchAnnotation[];
  updatedAt: string;
}

export function newResearchDocument(replay: ReplayIdentity, now = new Date().toISOString()): ResearchDocument {
  return {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    replay,
    title: replay.filename.replace(/\.replay$/i, ""),
    summary: "",
    annotations: [],
    updatedAt: now,
  };
}

function generatedId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newAnnotation(
  kind: AnnotationKind,
  author: string,
  anchor?: EventAnchor,
  now = new Date().toISOString(),
): ResearchAnnotation {
  return {
    id: generatedId(),
    kind,
    title: kind === "general" ? "Replay note" : kind === "sequence" ? "Interesting sequence" : "Bookmark",
    ...(anchor && kind !== "general" ? { start: anchor } : {}),
    ...(anchor && (kind === "range" || kind === "sequence") ? { end: anchor } : {}),
    observation: "",
    status: "candidate",
    tags: [],
    highlights: [],
    provenance: { source: "human", author, createdAt: now, updatedAt: now },
  };
}

export function mergeResearchDocuments(base: ResearchDocument, incoming: ResearchDocument): ResearchDocument {
  const byId = new Map(base.annotations.map((annotation) => [annotation.id, annotation]));
  for (const annotation of incoming.annotations) {
    const previous = byId.get(annotation.id);
    if (!previous || annotation.provenance.updatedAt >= previous.provenance.updatedAt) byId.set(annotation.id, annotation);
  }
  return {
    ...base,
    ...incoming,
    replay: base.replay,
    annotations: [...byId.values()].sort(compareAnnotations),
    updatedAt: base.updatedAt >= incoming.updatedAt ? base.updatedAt : incoming.updatedAt,
  };
}

export function compareAnnotations(a: ResearchAnnotation, b: ResearchAnnotation): number {
  const ar = a.start?.round ?? -1;
  const br = b.start?.round ?? -1;
  return ar - br || a.provenance.createdAt.localeCompare(b.provenance.createdAt) || a.id.localeCompare(b.id);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateResearchDocument(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ["Research document must be a JSON object."];
  if (value.schemaVersion !== RESEARCH_SCHEMA_VERSION) errors.push(`schemaVersion must be ${RESEARCH_SCHEMA_VERSION}.`);
  if (!isObject(value.replay)) errors.push("replay must be an object.");
  else {
    if (typeof value.replay.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.replay.sha256))
      errors.push("replay.sha256 must be a lowercase SHA-256 digest.");
    if (typeof value.replay.filename !== "string" || !value.replay.filename) errors.push("replay.filename is required.");
    if (!Number.isInteger(value.replay.formatVersion) || Number(value.replay.formatVersion) < 0)
      errors.push("replay.formatVersion must be a non-negative integer.");
    if (!Number.isInteger(value.replay.rounds) || Number(value.replay.rounds) < 0)
      errors.push("replay.rounds must be a non-negative integer.");
  }
  if (typeof value.title !== "string") errors.push("title must be a string.");
  if (typeof value.summary !== "string") errors.push("summary must be a string.");
  if (!Array.isArray(value.annotations)) errors.push("annotations must be an array.");
  else {
    const ids = new Set<string>();
    value.annotations.forEach((raw, index) => {
      const at = `annotations[${index}]`;
      if (!isObject(raw)) {
        errors.push(`${at} must be an object.`);
        return;
      }
      if (typeof raw.id !== "string" || !raw.id) errors.push(`${at}.id is required.`);
      else if (ids.has(raw.id)) errors.push(`${at}.id duplicates ${raw.id}.`);
      else ids.add(raw.id);
      if (!["general", "point", "range", "sequence"].includes(String(raw.kind))) errors.push(`${at}.kind is invalid.`);
      if (typeof raw.title !== "string" || !raw.title.trim()) errors.push(`${at}.title is required.`);
      if (typeof raw.observation !== "string") errors.push(`${at}.observation must be a string.`);
      if (!["candidate", "confirmed", "rejected", "needs-evidence"].includes(String(raw.status)))
        errors.push(`${at}.status is invalid.`);
      if (!Array.isArray(raw.tags) || raw.tags.some((tag) => typeof tag !== "string"))
        errors.push(`${at}.tags must be strings.`);
      if (raw.confidence !== undefined && (typeof raw.confidence !== "number" || raw.confidence < 0 || raw.confidence > 1))
        errors.push(`${at}.confidence must be between 0 and 1.`);
      if (raw.kind !== "general" && !isObject(raw.start)) errors.push(`${at}.start is required for timed annotations.`);
      if ((raw.kind === "range" || raw.kind === "sequence") && !isObject(raw.end))
        errors.push(`${at}.end is required for range and sequence annotations.`);
      const startRound = isObject(raw.start) ? raw.start.round : undefined;
      const endRound = isObject(raw.end) ? raw.end.round : undefined;
      if (startRound !== undefined && (!Number.isInteger(startRound) || Number(startRound) < 0))
        errors.push(`${at}.start.round must be a non-negative integer.`);
      if (endRound !== undefined && (!Number.isInteger(endRound) || Number(endRound) < 0))
        errors.push(`${at}.end.round must be a non-negative integer.`);
      if (Number.isInteger(startRound) && Number.isInteger(endRound) && Number(endRound) < Number(startRound))
        errors.push(`${at}.end.round must be greater than or equal to start.round.`);
      if (raw.dragonIds !== undefined) {
        if (
          !Array.isArray(raw.dragonIds) ||
          raw.dragonIds.some((id) => !Number.isInteger(id) || Number(id) < 0) ||
          new Set(raw.dragonIds).size !== raw.dragonIds.length
        ) errors.push(`${at}.dragonIds must be unique non-negative integers.`);
      }
      if (raw.steps !== undefined) {
        if (!Array.isArray(raw.steps)) errors.push(`${at}.steps must be an array.`);
        else raw.steps.forEach((step, stepIndex) => {
          const stepAt = `${at}.steps[${stepIndex}]`;
          if (!isObject(step)) {
            errors.push(`${stepAt} must be an object.`);
            return;
          }
          if (!isObject(step.anchor) || !Number.isInteger(step.anchor.round) || Number(step.anchor.round) < 0)
            errors.push(`${stepAt}.anchor.round must be a non-negative integer.`);
          if (typeof step.label !== "string" || !step.label.trim()) errors.push(`${stepAt}.label is required.`);
          if (
            step.dragonIds !== undefined &&
            (!Array.isArray(step.dragonIds) ||
              step.dragonIds.some((id) => !Number.isInteger(id) || Number(id) < 0) ||
              new Set(step.dragonIds).size !== step.dragonIds.length)
          ) errors.push(`${stepAt}.dragonIds must be unique non-negative integers.`);
        });
      }
      if (!isObject(raw.provenance)) errors.push(`${at}.provenance is required.`);
      else if (!["human", "agent", "detector"].includes(String(raw.provenance.source)))
        errors.push(`${at}.provenance.source is invalid.`);
    });
  }
  if (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt)))
    errors.push("updatedAt must be an ISO date string.");
  return errors;
}

export function parseResearchDocument(text: string): ResearchDocument {
  const value: unknown = JSON.parse(text);
  const errors = validateResearchDocument(value);
  if (errors.length) throw new Error(errors.join("\n"));
  return value as ResearchDocument;
}
