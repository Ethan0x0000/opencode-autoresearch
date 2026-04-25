import { describe, expect, it } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const ALLOWED_FILES = new Set([
  path.join(ROOT, "src/compat/zero-width.ts"),
  path.join(ROOT, "tests/agent-ordering.test.ts"),
  path.join(ROOT, "tests/no-invisible-scatter.test.ts"),
])
const IGNORED_PARTS = new Set(["node_modules", "dist", "refer", ".git", ".sisyphus"])
const INVISIBLE_BYTES = /[\u200B\u200C\u200D\uFEFF]/

async function collectFiles(dir: string, files: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (IGNORED_PARTS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files)
      continue
    }
    if (entry.isFile()) files.push(fullPath)
  }
  return files
}

describe("no invisible scatter", () => {
  it("keeps U+200B confined to the canonical source and approved fixtures", async () => {
    const files = await collectFiles(ROOT)
    const offenders: string[] = []

    for (const file of files) {
      const content = await readFile(file, "utf8")
      if (INVISIBLE_BYTES.test(content) && !ALLOWED_FILES.has(file)) {
        offenders.push(path.relative(ROOT, file))
      }
    }

    expect(offenders).toEqual([])
  })
})
