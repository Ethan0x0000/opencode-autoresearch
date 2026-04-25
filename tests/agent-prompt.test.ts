import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { resolve } from "path"

const content = readFileSync(resolve("agent/autoresearch.md"), "utf-8")

const requiredHeadings = [
  "## prompt plan",
  "## setup plan",
  "## onboarding packet",
  "## recommend next",
  "## log experiment",
  "## doctor",
  "## checks inspect",
  "## benchmark lint",
  "## export/finalize preview",
]

describe("autoresearch agent prompt", () => {
  test("has one markdown agent definition with the required scope and stages", () => {
    expect(content.startsWith("---\n")).toBe(true)
    expect(content).toContain("name: autoresearch")
    expect(content).toContain("mode: subagent")
    expect(content).toContain("description: Measured autonomous research loop for one repo-local packet stream")
    expect((content.match(/^name:/gm) ?? []).length).toBe(1)
    expect((content.match(/^mode:/gm) ?? []).length).toBe(1)

    for (const heading of requiredHeadings) {
      expect(content).toContain(heading)
    }

    for (const command of [
      "prompt_plan",
      "setup_plan",
      "onboarding_packet",
      "recommend_next",
      "log_experiment",
      "doctor",
      "checks_inspect",
      "benchmark_lint",
      "export",
      "finalize_preview",
    ]) {
      expect(content).toContain(`\`${command}\``)
    }
  })

  test("keeps v1 scope bounded and refer read-only", () => {
    expect(content).toContain("Treat `refer/*` as read-only reference and never modify anything under it.")
    expect(content).toContain("Preserve `autoresearch.md`, `autoresearch.jsonl`, `autoresearch.ideas.md`, scratchpads, and logs.")
    expect(content).toContain("Use the plugin commands and state files, not chat memory, as the loop source of truth.")
    expect(content).toContain("V1 is loop-only, so do not promise dashboard, browser, TUI, or MCP parity.")
    expect(content).toContain("Do not expand into unbounded dashboard work or unrelated MCP work.")
  })
})
