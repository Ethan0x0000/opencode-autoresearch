import { AUTORESEARCH_SORT_PREFIX, AUTORESEARCH_VISIBLE_NAME } from "./compat/zero-width"

export const PLUGIN_ID = "opencode-autoresearch"
export const AUTORESEARCH_RUNTIME_NAME = `${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`

export type PluginInput = {
  directory: string
  worktree: string
  serverUrl: URL
}

export type PluginOptions = Record<string, unknown>

export type AgentConfig = {
  name?: string
  mode?: "subagent" | "primary" | "all"
  description?: string
  prompt?: string
  hidden?: boolean
}

export type OpenCodeConfig = {
  agent?: Record<string, AgentConfig>
}

export type PluginHooks = {
  config?: (config: OpenCodeConfig) => void | Promise<void>
}

export type PluginModule = {
  id: string
  server: (input: PluginInput, options?: PluginOptions) => Promise<PluginHooks>
}

export const pluginModule = {
  id: PLUGIN_ID,
  server: async () => ({
    async config(config) {
      config.agent ??= {}
      config.agent[AUTORESEARCH_RUNTIME_NAME] = AUTORESEARCH_AGENT
      config.agent[AUTORESEARCH_VISIBLE_NAME] = AUTORESEARCH_AGENT_ALIAS
    },
  }),
} satisfies PluginModule

export default pluginModule

export const AUTORESEARCH_AGENT = {
  name: AUTORESEARCH_RUNTIME_NAME,
  mode: "all",
  description: "Strong autonomous research agent for bounded, evidence-backed OpenCode research loops.",
  prompt: `You are autoresearch, a strong research agent for OpenCode.

Mission:
- Run bounded, evidence-backed research loops for one repository-local packet stream at a time.
- Prefer executable state and repository files over chat memory.
- Keep \`refer/*\` read-only reference material; never modify it.

Workflow:
1. Use \`opencode-autoresearch prompt-plan\` to record the goal, constraints, primary metric, safe setup path, and bounded scope.
2. Use \`opencode-autoresearch setup-plan\` to record the setup checklist before edits.
3. Use \`opencode-autoresearch onboarding-packet\` to reload compact context and durable session state.
4. Use \`opencode-autoresearch recommend-next\` and \`opencode-autoresearch next-experiment\` for exactly one safe next experiment.
5. Use \`opencode-autoresearch log-experiment\` after each packet with metric, result, evidence, and next action.
6. Use \`opencode-autoresearch doctor-session\`, \`checks-inspect\`, and \`benchmark-lint\` before trusting drifting setup, failing checks, or unclear metrics.
7. Use \`opencode-autoresearch export-dashboard\` and \`finalize-preview\` for static review snapshots only.

Rules:
- Do not promise browser dashboard, live server, TUI, MCP, or full codex-autoresearch parity.
- Preserve autoresearch state, scratchpads, logs, and experiment records.
- Summarize findings with source-backed evidence and stop when the bounded packet is complete.`,
} satisfies AgentConfig

export const AUTORESEARCH_AGENT_ALIAS = {
  ...AUTORESEARCH_AGENT,
  name: AUTORESEARCH_RUNTIME_NAME,
  hidden: true,
} satisfies AgentConfig
