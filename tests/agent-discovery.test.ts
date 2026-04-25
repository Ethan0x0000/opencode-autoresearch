import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "fs"
import { mkdtempSync, rmSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"
import { copyAutoresearchAgent } from "../src/compat/plugin-loader-fixture"

describe("agent discovery contract", () => {
  test("packages agent/autoresearch.md as a discoverable asset", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"))
    expect(pkg.files).toContain("agent")
    expect(existsSync(resolve("agent/autoresearch.md"))).toBe(true)
  })

  test("fallback installer copies the packaged agent into config agent directory", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "opencode-autoresearch-config-"))

    try {
      const copied = await copyAutoresearchAgent(configDir)
      const target = join(configDir, "agent", "autoresearch.md")
      expect(copied).toBe(target)
      expect(readFileSync(target, "utf-8")).toBe(readFileSync(resolve("agent/autoresearch.md"), "utf-8"))
    } finally {
      rmSync(configDir, { recursive: true, force: true })
    }
  })
})
