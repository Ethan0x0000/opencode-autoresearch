import { optionString, stateContract, type CommandContext, type CommandHandler } from "../cli"
import { METRIC_DIRECTIONS, type MetricDirection, type SessionNote, type SessionState } from "../session/schema"

type DoctorIssue = {
  code: "missing_goal" | "missing_setup" | "stale_experiments" | "corrupt_recovery"
  message: string
}

export const doctorHandlers = {
  "doctor-session": async (context) => {
    const read = await context.store.read(context.sessionId)
    const recoveredIssue: DoctorIssue | undefined =
      read.status === "recovered" ? { code: "corrupt_recovery", message: read.reason } : undefined
    const state = read.status === "ready" ? read.state : await context.store.create({ sessionId: context.sessionId })
    const issues = doctorIssues(state, recoveredIssue)

    return stateContract(context, "doctor", {
      healthy: issues.length === 0,
      issues,
      pendingCount: state.experiments.filter((experiment) => experiment.status === "pending").length,
    })
  },
  "checks-inspect": async (context) => {
    const state = await ensureSession(context)
    const summary = optionString(context.args, "summary") ?? optionString(context.args, "output") ?? context.args._.join(" ").trim()
    const saved = summary
      ? await context.store.save({ ...state, notes: upsertNote(state.notes, "checks-inspect", summary) })
      : state

    return stateContract(context, "doctor", {
      checkSummary: summary || "",
      recorded: summary.length > 0,
      noteCount: saved.notes.length,
    })
  },
  "benchmark-lint": async (context) => {
    const metricName = optionString(context.args, "metric-name") ?? optionString(context.args, "metricName")
    const metricDirection = optionString(context.args, "metric-direction") ?? optionString(context.args, "metricDirection")
    const command = optionString(context.args, "command")
    const missingFields = [
      ["metric-name", metricName],
      ["metric-direction", metricDirection],
      ["command", command],
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field)

    let normalizedDirection: MetricDirection | undefined
    if (metricDirection) normalizedDirection = parseMetricDirection(metricDirection)

    return stateContract(context, "doctor", {
      valid: missingFields.length === 0,
      missingFields,
      metricName: metricName ?? null,
      metricDirection: normalizedDirection ?? null,
      benchmarkCommand: command ?? null,
    })
  },
} satisfies Record<"doctor-session" | "checks-inspect" | "benchmark-lint", CommandHandler>

async function ensureSession(context: CommandContext): Promise<SessionState> {
  const existing = await context.store.read(context.sessionId)
  if (existing.status === "ready") return existing.state
  return context.store.create({ sessionId: context.sessionId })
}

function doctorIssues(state: SessionState, recoveredIssue?: DoctorIssue): DoctorIssue[] {
  const issues: DoctorIssue[] = []
  if (recoveredIssue) issues.push(recoveredIssue)
  if (!state.goal.trim()) issues.push({ code: "missing_goal", message: "Record a goal with prompt-plan." })
  if (state.setup.checklist.length === 0) {
    issues.push({ code: "missing_setup", message: "Record setup checklist items with setup-plan." })
  }
  const pending = state.experiments.filter((experiment) => experiment.status === "pending")
  if (pending.length > 0) {
    issues.push({
      code: "stale_experiments",
      message: `Log or resolve pending experiments: ${pending.map((experiment) => experiment.id).join(", ")}`,
    })
  }
  return issues
}

function upsertNote(notes: SessionNote[], id: string, text: string): SessionNote[] {
  const note = { id, text, createdAt: new Date().toISOString() }
  const index = notes.findIndex((candidate) => candidate.id === id)
  if (index === -1) return [...notes, note]
  return [...notes.slice(0, index), { ...note, createdAt: notes[index].createdAt }, ...notes.slice(index + 1)]
}

function parseMetricDirection(value: string): MetricDirection {
  if ((METRIC_DIRECTIONS as readonly string[]).includes(value)) return value as MetricDirection
  throw new Error(`Invalid metric direction: ${value}. Expected one of ${METRIC_DIRECTIONS.join(", ")}`)
}
