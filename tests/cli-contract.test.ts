import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"

const repoRoot = resolve(import.meta.dir, "..")
const cliPath = join(repoRoot, "src", "cli.ts")
const commands = [
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
] as const

const statefulCommands = commands

async function runCli(args: string[], options: { cwd?: string } = {}) {
  const proc = Bun.spawn(["bun", cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

function helpCommands(help: string) {
  return help
    .split("\n")
    .map((line) => /^  ([a-z][a-z-]+)\s{2,}/.exec(line)?.[1])
    .filter((command): command is string => command !== undefined)
}

describe("CLI command contracts", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function tempDir(prefix: string) {
    const dir = mkdtempSync(join(tmpdir(), prefix))
    tempDirs.push(dir)
    return dir
  }

  test("--help lists exactly the v1 commands and marks export-dashboard as static only", async () => {
    const result = await runCli(["--help"])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(helpCommands(result.stdout)).toEqual([...commands])
    expect(result.stdout).toContain("export-dashboard writes a static snapshot only; it does not start a browser UI or live server.")
  })

  test("unknown commands fail deterministically without creating session state", async () => {
    const cwd = tempDir("opencode-autoresearch-cwd-")
    const stateDir = join(cwd, "custom state")
    const result = await runCli(["not-a-command", "--state-dir", stateDir], { cwd })

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("Unknown command: not-a-command\n")
    expect(existsSync(stateDir)).toBe(false)
    expect(existsSync(join(cwd, ".opencode-autoresearch"))).toBe(false)
  })

  test("workflow commands accept --state-dir without touching opencode internals", async () => {
    const cwd = tempDir("opencode-autoresearch-workflow-")

    for (const command of statefulCommands) {
      const stateDir = join(cwd, `${command} state`)
      const result = await runCli([command, "--state-dir", stateDir, "--session-id", "cli-contract"], { cwd })
      const payload = JSON.parse(result.stdout)

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe("")
      expect(payload).toMatchObject({
        ok: true,
        command,
        sessionId: "cli-contract",
        stateDir: resolve(stateDir),
        statePath: join(resolve(stateDir), "cli-contract.json"),
      })
      if (command === "export-dashboard") expect(payload.staticSnapshotOnly).toBe(true)
      expect(existsSync(join(cwd, ".opencode"))).toBe(false)
      expect(existsSync(join(cwd, ".opencode-autoresearch"))).toBe(false)
    }
  })
})
