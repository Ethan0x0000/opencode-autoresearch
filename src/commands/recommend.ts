import { stateContract, type CommandContext, type CommandHandler } from "../cli"
import type { SessionRecommendation, SessionState } from "../session/schema"

export const recommendHandlers = {
  "recommend-next": async (context) => {
    const state = await ensureSession(context)
    const recommendation = buildRecommendation(state)
    const existing = state.recommendations.find((candidate) => candidate.id === recommendation.id)
    const saved = existing
      ? state
      : await context.store.save({ ...state, recommendations: [...state.recommendations, recommendation] })

    return stateContract(context, "recommend", {
      recommendation: existing ?? recommendation,
      recommendationCount: saved.recommendations.length,
    })
  },
} satisfies Record<"recommend-next", CommandHandler>

async function ensureSession(context: CommandContext): Promise<SessionState> {
  const existing = await context.store.read(context.sessionId)
  if (existing.status === "ready") return existing.state
  return context.store.create({ sessionId: context.sessionId })
}

function buildRecommendation(state: SessionState): SessionRecommendation {
  const pending = state.experiments.find((experiment) => experiment.status === "pending")
  const completeCount = state.experiments.filter((experiment) => experiment.status !== "pending").length
  const fingerprint = `${state.experiments.length}-${completeCount}-${state.metrics.length}-${pending?.id ?? "none"}`
  const id = `rec-${fingerprint}`

  if (pending) {
    return {
      id,
      summary: `Log the result for ${pending.id} before starting another experiment.`,
      rationale: "A pending experiment is the safest next action because it preserves one stable lifecycle.",
      createdAt: new Date().toISOString(),
    }
  }

  if (state.experiments.length === 0) {
    return {
      id,
      summary: "Run one baseline experiment with the current setup.",
      rationale: "A baseline gives future experiments a measured comparison point.",
      createdAt: new Date().toISOString(),
    }
  }

  return {
    id,
    summary: "Try one small measured change against the current best result.",
    rationale: "Small reversible changes are safe after at least one logged result.",
    createdAt: new Date().toISOString(),
  }
}
