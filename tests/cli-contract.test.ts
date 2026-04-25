import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"
import { AUTORESEARCH_SORT_PREFIX, AUTORESEARCH_VISIBLE_NAME } from "../src/compat/zero-width"

const repoRoot = resolve(import.meta.dir, "..")
const cliPath = join(repoRoot, "src", "cli.ts")
const packagedAgentPath = join(repoRoot, "agent", "autoresearch.md")

const commands = [
  "install-agent",
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

const statefulCommands = commands.filter((command) => command !== "install-agent")

function frontmatterName(content: string) {
  const match = /^name: (.*)$/m.exec(content)
  if (!match) throw new Error("missing frontmatter name")
  return match[1]
}

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

  test("install-agent copies packaged agent and refuses overwrite unless forced", async () => {
    const configDir = tempDir("opencode autoresearch config ")
    const target = join(configDir, "agent", "autoresearch.md")
    const source = readFileSync(packagedAgentPath, "utf-8")
    const installedName = `${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`

    const first = await runCli(["install-agent", "--config-dir", configDir])
    expect(first.exitCode).toBe(0)
    expect(first.stderr).toBe("")
    expect(JSON.parse(first.stdout)).toEqual({ ok: true, path: target, overwritten: false })
    expect(frontmatterName(source)).toBe(AUTORESEARCH_VISIBLE_NAME)
    expect(frontmatterName(readFileSync(target, "utf-8"))).toBe(installedName)

    writeFileSync(target, "local edits", "utf-8")
    const refused = await runCli(["install-agent", "--config-dir", configDir])
    expect(refused.exitCode).toBe(1)
    expect(refused.stdout).toBe("")
    expect(refused.stderr).toBe(`Agent already exists: ${target}\nUse --force to overwrite.\n`)
    expect(readFileSync(target, "utf-8")).toBe("local edits")

    const forced = await runCli(["install-agent", "--config-dir", configDir, "--force"])
    expect(forced.exitCode).toBe(0)
    expect(JSON.parse(forced.stdout)).toEqual({ ok: true, path: target, overwritten: true })
    expect(frontmatterName(readFileSync(target, "utf-8"))).toBe(installedName)
  })

  test("install-agent always copies the packaged asset instead of a cwd-local shadow file", async () => {
    const cwd = tempDir("opencode-autoresearch-shadow-cwd-")
    const configDir = tempDir("opencode-autoresearch-shadow-config-")
    mkdirSync(join(cwd, "agent"), { recursive: true })
    writeFileSync(join(cwd, "agent", "autoresearch.md"), "shadow agent", "utf-8")

    const result = await runCli(["install-agent", "--config-dir", configDir], { cwd })

    expect(result.exitCode).toBe(0)
    expect(frontmatterName(readFileSync(join(configDir, "agent", "autoresearch.md"), "utf-8"))).toBe(
      `${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`,
    )
    expect(frontmatterName(readFileSync(packagedAgentPath, "utf-8"))).toBe(AUTORESEARCH_VISIBLE_NAME)
  })

  test("install-agent refuses symlinked destination paths", async () => {
    const configDir = tempDir("opencode-autoresearch-symlink-config-")
    const outsideDir = tempDir("opencode-autoresearch-symlink-outside-")
    mkdirSync(join(configDir, "agent"), { recursive: true })
    writeFileSync(join(outsideDir, "outside.md"), "do not replace", "utf-8")
    symlinkSync(join(outsideDir, "outside.md"), join(configDir, "agent", "autoresearch.md"))

    const result = await runCli(["install-agent", "--config-dir", configDir, "--force"])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe(`Refusing to write through symlink: ${join(configDir, "agent", "autoresearch.md")}\n`)
    expect(readFileSync(join(outsideDir, "outside.md"), "utf-8")).toBe("do not replace")
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
