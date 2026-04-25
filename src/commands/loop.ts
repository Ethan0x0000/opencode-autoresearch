import { optionString, stateContract, type CommandContext, type CommandHandler } from "../cli"
import {
  EXPERIMENT_STATUSES,
  METRIC_DIRECTIONS,
  type ExperimentStatus,
  type MetricDirection,
  type SessionMetric,
  type SessionState,
} from "../session/schema"

export const loopHandlers = {
  "next-experiment": async (context) => {
    const state = await ensureSession(context)
    const pending = state.experiments.find((experiment) => experiment.status === "pending")
    if (pending) {
      return stateContract(context, "loop", { experiment: pending, reusedPending: true })
    }

    const recommendation = state.recommendations.at(-1)
    const run = state.experiments.length + 1
    const id = `exp-${run}`
    const hypothesis = optionString(context.args, "hypothesis") ?? recommendation?.summary ?? "Run one baseline measurement."
    const saved = await context.store.appendExperiment(context.sessionId, {
      id,
      run,
      hypothesis,
      status: "pending",
      nextActionHint: "Run the experiment, then log its metric and status.",
    })
    const experiment = saved.experiments.find((candidate) => candidate.id === id)

    return stateContract(context, "loop", { experiment, reusedPending: false })
  },
  "log-experiment": async (context) => {
    const experimentId = optionString(context.args, "experiment-id") ?? optionString(context.args, "experimentId")
    if (!experimentId) {
      if (hasLogInput(context)) throw new Error("Missing experiment id for log-experiment")
      return stateContract(context, "loop", { requiresExperimentId: true })
    }

    const state = await ensureSession(context)
    const experiment = state.experiments.find((candidate) => candidate.id === experimentId)
    if (!experiment) throw new Error(`Unknown experiment id: ${experimentId}`)

    const status = parseStatus(optionString(context.args, "status") ?? experiment.status)
    const metric = parseMetric(context, experimentId)
    const saved = await context.store.appendExperiment(context.sessionId, {
      id: experiment.id,
      run: experiment.run,
      hypothesis: optionString(context.args, "hypothesis") ?? experiment.hypothesis,
      status,
      metric,
      evidence: optionString(context.args, "evidence") ?? optionString(context.args, "result") ?? experiment.evidence,
      rollbackReason: optionString(context.args, "rollback-reason") ?? optionString(context.args, "rollbackReason") ?? experiment.rollbackReason,
      nextActionHint: optionString(context.args, "next-action-hint") ?? optionString(context.args, "nextActionHint") ?? experiment.nextActionHint,
    })
    const updated = saved.experiments.find((candidate) => candidate.id === experiment.id)

    return stateContract(context, "loop", { experiment: updated, metric })
  },
} satisfies Record<"next-experiment" | "log-experiment", CommandHandler>

async function ensureSession(context: CommandContext): Promise<SessionState> {
  const existing = await context.store.read(context.sessionId)
  if (existing.status === "ready") return existing.state
  return context.store.create({ sessionId: context.sessionId })
}

function hasLogInput(context: CommandContext): boolean {
  return ["status", "metric-name", "metricName", "metric-value", "metricValue", "metric-direction", "metricDirection", "result", "evidence"].some(
    (key) => context.args[key] !== undefined,
  )
}

function parseStatus(value: string): ExperimentStatus {
  if ((EXPERIMENT_STATUSES as readonly string[]).includes(value)) return value as ExperimentStatus
  throw new Error(`Invalid experiment status: ${value}. Expected one of ${EXPERIMENT_STATUSES.join(", ")}`)
}

function parseMetric(context: CommandContext, experimentId: string): SessionMetric | undefined {
  const name = optionString(context.args, "metric-name") ?? optionString(context.args, "metricName")
  const rawValue = optionString(context.args, "metric-value") ?? optionString(context.args, "metricValue")
  const rawDirection = optionString(context.args, "metric-direction") ?? optionString(context.args, "metricDirection")
  const unit = optionString(context.args, "metric-unit") ?? optionString(context.args, "metricUnit")
  const hasMetricInput = name !== undefined || rawValue !== undefined || rawDirection !== undefined || unit !== undefined
  if (!hasMetricInput) return undefined
  if (!name) throw new Error("Missing metric name for log-experiment")
  if (rawValue === undefined) throw new Error("Missing metric value for log-experiment")
  const value = Number(rawValue)
  if (!Number.isFinite(value)) throw new Error(`Metric value must be finite: ${rawValue}`)
  const direction = parseMetricDirection(rawDirection)
  return unit ? { name, value, direction, unit, sourceExperimentId: experimentId } : { name, value, direction, sourceExperimentId: experimentId }
}

function parseMetricDirection(value: string | undefined): MetricDirection {
  if (value !== undefined && (METRIC_DIRECTIONS as readonly string[]).includes(value)) return value as MetricDirection
  throw new Error(`Invalid metric direction: ${value ?? "missing"}. Expected one of ${METRIC_DIRECTIONS.join(", ")}`)
}
