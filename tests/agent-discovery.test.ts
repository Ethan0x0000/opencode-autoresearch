import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "fs"
import { mkdtempSync, rmSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"
import { copyAutoresearchAgent } from "../src/compat/plugin-loader-fixture"
import { AUTORESEARCH_SORT_PREFIX, AUTORESEARCH_VISIBLE_NAME } from "../src/compat/zero-width"

function frontmatterName(content: string) {
  const match = /^name: (.*)$/m.exec(content)
  if (!match) throw new Error("missing frontmatter name")
  return match[1]
}

describe("agent discovery contract", () => {
  test("packages agent/autoresearch.md as a discoverable asset", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"))
    expect(pkg.files).toContain("agent")
    expect(existsSync(resolve("agent/autoresearch.md"))).toBe(true)
  })

  test("fallback installer writes runtime ordering into the config agent file", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "opencode-autoresearch-config-"))

    try {
      const copied = await copyAutoresearchAgent(configDir)
      const target = join(configDir, "agent", "autoresearch.md")
      expect(copied).toBe(target)
      expect(frontmatterName(readFileSync(resolve("agent/autoresearch.md"), "utf-8"))).toBe(AUTORESEARCH_VISIBLE_NAME)
      expect(frontmatterName(readFileSync(target, "utf-8"))).toBe(`${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`)
    } finally {
      rmSync(configDir, { recursive: true, force: true })
    }
  })
})
