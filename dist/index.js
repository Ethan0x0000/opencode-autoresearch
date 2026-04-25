// @bun
// src/compat/zero-width.ts
var ZERO_WIDTH_SPACE = "\u200B";
var AUTORESEARCH_PREFIX_COUNT = 5;
var AUTORESEARCH_SORT_PREFIX = ZERO_WIDTH_SPACE.repeat(AUTORESEARCH_PREFIX_COUNT);
var AUTORESEARCH_VISIBLE_NAME = "autoresearch";

// src/index.ts
var PLUGIN_ID = "opencode-autoresearch";
var AUTORESEARCH_RUNTIME_NAME = `${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`;
var pluginModule = {
  id: PLUGIN_ID,
  server: async () => ({
    async config(config) {
      config.agent ??= {};
      config.agent[AUTORESEARCH_RUNTIME_NAME] = AUTORESEARCH_AGENT;
      config.agent[AUTORESEARCH_VISIBLE_NAME] = AUTORESEARCH_AGENT_ALIAS;
    }
  })
};
var src_default = pluginModule;
var AUTORESEARCH_AGENT = {
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
- Summarize findings with source-backed evidence and stop when the bounded packet is complete.`
};
var AUTORESEARCH_AGENT_ALIAS = {
  ...AUTORESEARCH_AGENT,
  name: AUTORESEARCH_RUNTIME_NAME,
  hidden: true
};
export {
  pluginModule,
  src_default as default,
  PLUGIN_ID,
  AUTORESEARCH_RUNTIME_NAME,
  AUTORESEARCH_AGENT_ALIAS,
  AUTORESEARCH_AGENT
};
