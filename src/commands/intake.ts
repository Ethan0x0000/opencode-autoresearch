import { optionString, stateContract, type CliOptions, type CommandContext, type CommandHandler } from "../cli"
import type { SessionNote, SessionState } from "../session/schema"

export const intakeHandlers = {
  "prompt-plan": async (context) => {
    const state = await ensureSession(context)
    const goal = optionString(context.args, "goal") ?? context.args._.join(" ").trim()
    const constraints = optionList(context.args, "constraints", "constraint")
    const nextState: SessionState = {
      ...state,
      goal: goal || state.goal,
      notes: constraints.length > 0 ? upsertNote(state.notes, "constraints", constraints.join("\n")) : state.notes,
    }
    const saved = await context.store.save(nextState)

    return stateContract(context, "intake", {
      goal: saved.goal,
      constraints: constraintsFromState(saved),
      status: saved.status,
    })
  },
  "setup-plan": async (context) => {
    const state = await ensureSession(context)
    const checklist = optionList(context.args, "checklist", "check")
    const notes = optionString(context.args, "notes") ?? optionString(context.args, "setup-notes")
    const saved = await context.store.save({
      ...state,
      setup: {
        checklist: checklist.length > 0 ? checklist : state.setup.checklist,
        notes: notes ?? state.setup.notes,
      },
      status: "setup",
    })

    return stateContract(context, "intake", {
      checklist: saved.setup.checklist,
      setupNotes: saved.setup.notes,
      status: saved.status,
    })
  },
  "onboarding-packet": async (context) => {
    const state = await ensureSession(context)
    const constraints = constraintsFromState(state)
    const checklist = state.setup.checklist
    const summary = [
      `Goal: ${state.goal || "not recorded"}`,
      `Constraints: ${constraints.length > 0 ? constraints.join("; ") : "none recorded"}`,
      `Setup: ${checklist.length > 0 ? checklist.join("; ") : "not recorded"}`,
      `Experiments: ${state.experiments.length}`,
    ].join("\n")

    return stateContract(context, "intake", {
      summary,
      goal: state.goal,
      constraints,
      checklist,
      experimentCount: state.experiments.length,
    })
  },
} satisfies Record<"prompt-plan" | "setup-plan" | "onboarding-packet", CommandHandler>

async function ensureSession(context: CommandContext): Promise<SessionState> {
  const existing = await context.store.read(context.sessionId)
  if (existing.status === "ready") return existing.state
  return context.store.create({ sessionId: context.sessionId })
}

function optionList(options: CliOptions, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = options[key]
    if (Array.isArray(value)) return value.flatMap(splitList)
    if (typeof value === "string") return splitList(value)
  }
  return []
}

function splitList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function upsertNote(notes: SessionNote[], id: string, text: string): SessionNote[] {
  const note = { id, text, createdAt: new Date().toISOString() }
  const index = notes.findIndex((candidate) => candidate.id === id)
  if (index === -1) return [...notes, note]
  return [...notes.slice(0, index), { ...note, createdAt: notes[index].createdAt }, ...notes.slice(index + 1)]
}

function constraintsFromState(state: SessionState): string[] {
  const note = state.notes.find((candidate) => candidate.id === "constraints")
  return note ? splitList(note.text) : []
}
