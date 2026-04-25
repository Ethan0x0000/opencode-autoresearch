export const SESSION_SCHEMA_VERSION = 1

export const SESSION_STATUSES = ["new", "setup", "running", "complete", "blocked"] as const
export const EXPERIMENT_STATUSES = ["pending", "keep", "discard", "crash", "checks_failed"] as const
export const METRIC_DIRECTIONS = ["higher", "lower"] as const

export type SessionStatus = (typeof SESSION_STATUSES)[number]
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number]
export type MetricDirection = (typeof METRIC_DIRECTIONS)[number]

export type SessionSetup = {
  checklist: string[]
  notes: string
}

export type SessionMetric = {
  name: string
  value: number
  direction: MetricDirection
  unit?: string
  sourceExperimentId?: string
}

export type SessionExperiment = {
  id: string
  run: number
  hypothesis: string
  status: ExperimentStatus
  createdAt: string
  updatedAt: string
  metric?: SessionMetric
  evidence?: string
  rollbackReason?: string
  nextActionHint?: string
}

export type SessionRecommendation = {
  id: string
  summary: string
  createdAt: string
  rationale?: string
}

export type SessionNote = {
  id: string
  text: string
  createdAt: string
}

export type SessionState = {
  schemaVersion: typeof SESSION_SCHEMA_VERSION
  sessionId: string
  goal: string
  setup: SessionSetup
  status: SessionStatus
  createdAt: string
  updatedAt: string
  experiments: SessionExperiment[]
  metrics: SessionMetric[]
  recommendations: SessionRecommendation[]
  notes: SessionNote[]
}

export type NewSessionStateInput = {
  sessionId: string
  goal?: string
  setup?: Partial<SessionSetup>
  status?: SessionStatus
}

export type NewSessionExperimentInput = {
  id: string
  run: number
  hypothesis: string
  status: ExperimentStatus
  metric?: SessionMetric
  evidence?: string
  rollbackReason?: string
  nextActionHint?: string
}

export type SessionParseResult =
  | { ok: true; state: SessionState }
  | { ok: false; kind: "corrupt"; reason: string }
  | { ok: false; kind: "future-version"; version: number; reason: string }

type RecordValue = Record<string, unknown>

export function createInitialSessionState(input: NewSessionStateInput, timestamp: string): SessionState {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: input.sessionId,
    goal: input.goal ?? "",
    setup: {
      checklist: input.setup?.checklist ?? [],
      notes: input.setup?.notes ?? "",
    },
    status: input.status ?? "new",
    createdAt: timestamp,
    updatedAt: timestamp,
    experiments: [],
    metrics: [],
    recommendations: [],
    notes: [],
  }
}

export function parseSessionState(value: unknown): SessionParseResult {
  if (!isRecord(value)) return corrupt("Session state must be a JSON object")

  const schemaVersion = value.schemaVersion
  if (typeof schemaVersion === "number" && schemaVersion > SESSION_SCHEMA_VERSION) {
    return {
      ok: false,
      kind: "future-version",
      version: schemaVersion,
      reason: `Unsupported future session schema version ${schemaVersion}; supported version is ${SESSION_SCHEMA_VERSION}`,
    }
  }

  if (schemaVersion !== SESSION_SCHEMA_VERSION) {
    return corrupt(`Session schemaVersion must be ${SESSION_SCHEMA_VERSION}`)
  }

  const sessionId = requiredString(value, "sessionId")
  const goal = requiredString(value, "goal")
  const setup = parseSetup(value.setup)
  const status = parseEnum(value.status, SESSION_STATUSES, "status")
  const createdAt = requiredString(value, "createdAt")
  const updatedAt = requiredString(value, "updatedAt")
  const experiments = parseArray(value.experiments, parseExperiment, "experiments")
  const metrics = parseArray(value.metrics, parseMetric, "metrics")
  const recommendations = parseArray(value.recommendations, parseRecommendation, "recommendations")
  const notes = parseArray(value.notes, parseNote, "notes")

  const failure = firstFailure([
    sessionId,
    goal,
    setup,
    status,
    createdAt,
    updatedAt,
    experiments,
    metrics,
    recommendations,
    notes,
  ])
  if (failure) return corrupt(failure)

  return {
    ok: true,
    state: {
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: fieldValue(sessionId),
      goal: fieldValue(goal),
      setup: fieldValue(setup),
      status: fieldValue(status),
      createdAt: fieldValue(createdAt),
      updatedAt: fieldValue(updatedAt),
      experiments: fieldValue(experiments),
      metrics: fieldValue(metrics),
      recommendations: fieldValue(recommendations),
      notes: fieldValue(notes),
    },
  }
}

export function createExperiment(input: NewSessionExperimentInput, timestamp: string): SessionExperiment {
  return {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requiredString(record: RecordValue, key: string): FieldResult<string> {
  const value = record[key]
  if (typeof value !== "string") return { ok: false, reason: `${key} must be a string` }
  return { ok: true, value }
}

function optionalString(record: RecordValue, key: string): FieldResult<string | undefined> {
  const value = record[key]
  if (value === undefined) return { ok: true, value: undefined }
  if (typeof value !== "string") return { ok: false, reason: `${key} must be a string when present` }
  return { ok: true, value }
}

function parseSetup(value: unknown): FieldResult<SessionSetup> {
  if (!isRecord(value)) return { ok: false, reason: "setup must be an object" }
  const checklist = parseStringArray(value.checklist, "setup.checklist")
  const notes = requiredString(value, "notes")
  const failure = firstFailure([checklist, notes])
  if (failure) return { ok: false, reason: failure }
  return { ok: true, value: { checklist: fieldValue(checklist), notes: fieldValue(notes) } }
}

function parseStringArray(value: unknown, key: string): FieldResult<string[]> {
  if (!Array.isArray(value)) return { ok: false, reason: `${key} must be an array` }
  if (!value.every((item) => typeof item === "string")) {
    return { ok: false, reason: `${key} must contain only strings` }
  }
  return { ok: true, value }
}

function parseMetric(value: unknown): FieldResult<SessionMetric> {
  if (!isRecord(value)) return { ok: false, reason: "metric must be an object" }
  const name = requiredString(value, "name")
  const metricValue = finiteNumber(value.value, "value")
  const direction = parseEnum(value.direction, METRIC_DIRECTIONS, "direction")
  const unit = optionalString(value, "unit")
  const sourceExperimentId = optionalString(value, "sourceExperimentId")
  const failure = firstFailure([name, metricValue, direction, unit, sourceExperimentId])
  if (failure) return { ok: false, reason: failure }

  const metric: SessionMetric = {
    name: fieldValue(name),
    value: fieldValue(metricValue),
    direction: fieldValue(direction),
  }
  const unitValue = fieldValue(unit)
  const sourceExperimentIdValue = fieldValue(sourceExperimentId)
  if (unitValue !== undefined) metric.unit = unitValue
  if (sourceExperimentIdValue !== undefined) metric.sourceExperimentId = sourceExperimentIdValue
  return { ok: true, value: metric }
}

function parseExperiment(value: unknown): FieldResult<SessionExperiment> {
  if (!isRecord(value)) return { ok: false, reason: "experiment must be an object" }
  const id = requiredString(value, "id")
  const run = finiteInteger(value.run, "run")
  const hypothesis = requiredString(value, "hypothesis")
  const status = parseEnum(value.status, EXPERIMENT_STATUSES, "status")
  const createdAt = requiredString(value, "createdAt")
  const updatedAt = requiredString(value, "updatedAt")
  const metric = value.metric === undefined ? ok<SessionMetric | undefined>(undefined) : parseMetric(value.metric)
  const evidence = optionalString(value, "evidence")
  const rollbackReason = optionalString(value, "rollbackReason")
  const nextActionHint = optionalString(value, "nextActionHint")
  const failure = firstFailure([
    id,
    run,
    hypothesis,
    status,
    createdAt,
    updatedAt,
    metric,
    evidence,
    rollbackReason,
    nextActionHint,
  ])
  if (failure) return { ok: false, reason: failure }

  const experiment: SessionExperiment = {
    id: fieldValue(id),
    run: fieldValue(run),
    hypothesis: fieldValue(hypothesis),
    status: fieldValue(status),
    createdAt: fieldValue(createdAt),
    updatedAt: fieldValue(updatedAt),
  }
  const metricValue = fieldValue(metric)
  const evidenceValue = fieldValue(evidence)
  const rollbackReasonValue = fieldValue(rollbackReason)
  const nextActionHintValue = fieldValue(nextActionHint)
  if (metricValue !== undefined) experiment.metric = metricValue
  if (evidenceValue !== undefined) experiment.evidence = evidenceValue
  if (rollbackReasonValue !== undefined) experiment.rollbackReason = rollbackReasonValue
  if (nextActionHintValue !== undefined) experiment.nextActionHint = nextActionHintValue
  return { ok: true, value: experiment }
}

function parseRecommendation(value: unknown): FieldResult<SessionRecommendation> {
  if (!isRecord(value)) return { ok: false, reason: "recommendation must be an object" }
  const id = requiredString(value, "id")
  const summary = requiredString(value, "summary")
  const createdAt = requiredString(value, "createdAt")
  const rationale = optionalString(value, "rationale")
  const failure = firstFailure([id, summary, createdAt, rationale])
  if (failure) return { ok: false, reason: failure }
  const recommendation: SessionRecommendation = {
    id: fieldValue(id),
    summary: fieldValue(summary),
    createdAt: fieldValue(createdAt),
  }
  const rationaleValue = fieldValue(rationale)
  if (rationaleValue !== undefined) recommendation.rationale = rationaleValue
  return { ok: true, value: recommendation }
}

function parseNote(value: unknown): FieldResult<SessionNote> {
  if (!isRecord(value)) return { ok: false, reason: "note must be an object" }
  const id = requiredString(value, "id")
  const text = requiredString(value, "text")
  const createdAt = requiredString(value, "createdAt")
  const failure = firstFailure([id, text, createdAt])
  if (failure) return { ok: false, reason: failure }
  return { ok: true, value: { id: fieldValue(id), text: fieldValue(text), createdAt: fieldValue(createdAt) } }
}

function parseArray<T>(value: unknown, parseItem: (item: unknown) => FieldResult<T>, key: string): FieldResult<T[]> {
  if (!Array.isArray(value)) return { ok: false, reason: `${key} must be an array` }
  const parsed: T[] = []
  for (const item of value) {
    const result = parseItem(item)
    if (!result.ok) return { ok: false, reason: `${key}: ${result.reason}` }
    parsed.push(result.value)
  }
  return { ok: true, value: parsed }
}

function finiteNumber(value: unknown, key: string): FieldResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, reason: `${key} must be a finite number` }
  return { ok: true, value }
}

function finiteInteger(value: unknown, key: string): FieldResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, reason: `${key} must be a non-negative integer` }
  }
  return { ok: true, value }
}

function parseEnum<const T extends readonly string[]>(value: unknown, allowed: T, key: string): FieldResult<T[number]> {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return { ok: false, reason: `${key} must be one of: ${allowed.join(", ")}` }
  }
  return { ok: true, value }
}

type FieldResult<T> = { ok: true; value: T } | { ok: false; reason: string }

function ok<T>(value: T): FieldResult<T> {
  return { ok: true, value }
}

function fieldValue<T>(result: FieldResult<T>): T {
  if (!result.ok) throw new Error(result.reason)
  return result.value
}

function corrupt(reason: string): SessionParseResult {
  return { ok: false, kind: "corrupt", reason }
}

function firstFailure(results: FieldResult<unknown>[]): string | undefined {
  return results.find((result) => !result.ok)?.reason
}
