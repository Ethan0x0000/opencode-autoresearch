import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { resolve } from "path"

const readme = readFileSync(resolve(import.meta.dir, "..", "README.md"), "utf8")

describe("README contract", () => {
  test("covers the current v1 scope and exclusions", () => {
    expect(readme).toContain("# Opencode Autoresearch")
    expect(readme).toContain("## Purpose")
    expect(readme).toContain("## v1 scope")
    expect(readme).toContain("## Non goals")
    expect(readme).toContain("## Install in OpenCode")
    expect(readme).toContain("## Local OpenCode config example")
    expect(readme).toContain("## Enable and disable")
    expect(readme).toContain("## Coexistence with oh-my-openagent")
    expect(readme).toContain("## Zero width ordering")
    expect(readme).toContain("## Command reference")
    expect(readme).toContain("## State location")
    expect(readme).toContain("## Verification")
    expect(readme).toContain("## Troubleshooting")
    expect(readme).toContain("browser dashboard")
    expect(readme).toContain("live dashboard server")
    expect(readme).toContain("MCP server")
    expect(readme).toContain("full `codex-autoresearch` parity")
    expect(readme).toContain("npm publishing claim")
    expect(readme).toContain("refer/*")
    expect(readme).toContain("read only reference")
    expect(readme).toContain("not packaged")
    expect(readme).toContain("static snapshot only")
    expect(readme).toContain("does not start a browser UI or a live server")
    expect(readme).toContain('"plugin": ["opencode-autoresearch"]')
    expect(readme).toContain("Disable it by removing `opencode-autoresearch` from the `plugin` array")
    expect(readme).toContain("bun run test")
    expect(readme).toContain("bun test tests/readme.test.ts")
    expect(readme).toContain("Plain `bun test` is the full-project hardening goal")
    expect(readme).toContain("recurse into `refer/` fixtures")
  })

  test("documents plugin registration and binary surface", () => {
    expect(readme).toContain("plugin-injected `autoresearch` agent")
    expect(readme).toContain("The package also exposes the `opencode-autoresearch` binary")
    expect(readme).toContain("For local development, point OpenCode at the built package directory instead")
    expect(readme).toContain("/absolute/path/to/opencode-autoresearch")
    expect(readme).toContain("The supported enable path is the OpenCode `plugin` array")
    expect(readme).toContain("The supported disable path is removing `opencode-autoresearch` from that array")
  })

  test("documents the zero width ordering strategy with escaped notation only", () => {
    expect(readme).toContain("\\u200B")
    expect(readme).not.toMatch(/[\u200B\u200C\u200D\uFEFF]/)
    expect(readme).toContain("`sisyphus` uses `\\u200B`")
    expect(readme).toContain("`autoresearch` uses `\\u200B\\u200B\\u200B\\u200B\\u200B`")
  })

  test("lists the shipped commands and local verification commands", () => {
    for (const command of [
      "prompt-plan",
      "setup-plan",
      "onboarding-packet",
      "recommend-next",
      "next-experiment",
      "log-experiment",
      "doctor-session",
      "checks-inspect",
      "benchmark-lint",
      "export-dashboard",
      "finalize-preview",
    ]) {
      expect(readme).toContain(`\`${command}\``)
    }

    for (const command of [
      "bun install",
      "bun run build",
      "bun run typecheck",
      "bun run test",
      "bun test tests/readme.test.ts",
    ]) {
      expect(readme).toContain(command)
    }
  })

  test("contains no raw zero width bytes", () => {
    expect(readme).not.toMatch(/[\u200B\u200C\u200D\uFEFF]/)
  })
})
