import { mkdir, writeFile } from "fs/promises"
import { join, resolve } from "path"
import { optionString, stateContract, type CommandContext, type CommandHandler } from "../cli"
import type { SessionState } from "../session/schema"

export const exportHandlers = {
  "export-dashboard": async (context) => {
    const state = await ensureSession(context)
    const outputDir = resolve(optionString(context.args, "output-dir") ?? optionString(context.args, "outputDir") ?? context.store.baseDir)
    await mkdir(outputDir, { recursive: true })
    const snapshot = dashboardSnapshot(state)
    const jsonPath = join(outputDir, `${context.sessionId}-dashboard.json`)
    const markdownPath = join(outputDir, `${context.sessionId}-dashboard.md`)
    await writeFile(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8")
    await writeFile(markdownPath, dashboardMarkdown(snapshot), "utf-8")

    return stateContract(context, "export", {
      staticSnapshotOnly: true,
      jsonPath,
      markdownPath,
      snapshot,
    })
  },
  "finalize-preview": async (context) => {
    const state = await ensureSession(context)
    const pendingCount = state.experiments.filter((experiment) => experiment.status === "pending").length
    const completeCount = state.experiments.filter((experiment) => experiment.status !== "pending").length

    return stateContract(context, "export", {
      pendingCount,
      completeCount,
      wouldMutateSourceFiles: false,
      nextAction:
        pendingCount > 0
          ? "Log or discard pending experiments before finalizing."
          : "Review kept experiments before any manual finalization.",
    })
  },
} satisfies Record<"export-dashboard" | "finalize-preview", CommandHandler>

async function ensureSession(context: CommandContext): Promise<SessionState> {
  const existing = await context.store.read(context.sessionId)
  if (existing.status === "ready") return existing.state
  return context.store.create({ sessionId: context.sessionId })
}

function dashboardSnapshot(state: SessionState) {
  const pendingCount = state.experiments.filter((experiment) => experiment.status === "pending").length
  const completeCount = state.experiments.filter((experiment) => experiment.status !== "pending").length
  return {
    generatedAt: new Date().toISOString(),
    deliveryMode: "static-export",
    sessionId: state.sessionId,
    goal: state.goal,
    setup: state.setup,
    pendingCount,
    completeCount,
    experiments: state.experiments,
    metrics: state.metrics,
    recommendations: state.recommendations,
    notes: state.notes,
  }
}

function dashboardMarkdown(snapshot: ReturnType<typeof dashboardSnapshot>): string {
  const lines = [
    `# Autoresearch Dashboard Snapshot: ${snapshot.sessionId}`,
    "",
    "Static snapshot only; this file does not run commands or start a server.",
    "",
    `- Goal: ${snapshot.goal || "not recorded"}`,
    `- Pending experiments: ${snapshot.pendingCount}`,
    `- Complete experiments: ${snapshot.completeCount}`,
    `- Setup checklist: ${snapshot.setup.checklist.length > 0 ? snapshot.setup.checklist.join("; ") : "not recorded"}`,
    "",
    "## Experiments",
    "",
  ]
  if (snapshot.experiments.length === 0) lines.push("No experiments recorded.")
  for (const experiment of snapshot.experiments) {
    lines.push(`- ${experiment.id}: ${experiment.status} — ${experiment.hypothesis}`)
  }
  lines.push("")
  return `${lines.join("\n")}\n`
}
