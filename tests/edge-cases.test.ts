import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join, resolve } from "path"
import { pathToFileURL } from "url"
import { applyCanonicalRuntimeListPrefix, normalizeVisibleAgentName, sortFixtureNames } from "../src/compat/agent-ordering"
import { copyAutoresearchAgent, simulatePluginLoader } from "../src/compat/plugin-loader-fixture"
import { PLUGIN_ID } from "../src/index"
import { SESSION_SCHEMA_VERSION } from "../src/session/schema"
import { createSessionStore } from "../src/session/store"
import { AUTORESEARCH_SORT_PREFIX, AUTORESEARCH_VISIBLE_NAME } from "../src/compat/zero-width"

const repoRoot = resolve(import.meta.dir, "..")
const cliPath = join(repoRoot, "src", "cli.ts")
const packagedAgentPath = join(repoRoot, "agent", "autoresearch.md")

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

function parseJson(stdout: string) {
  return JSON.parse(stdout)
}

function frontmatterName(content: string) {
  const match = /^name: (.*)$/m.exec(content)
  if (!match) throw new Error("missing frontmatter name")
  return match[1]
}

async function expectRejects(promise: Promise<unknown>, pattern: RegExp) {
  let rejection: unknown
  try {
    await promise
  } catch (error) {
    rejection = error
  }
  if (rejection === undefined) throw new Error("Expected promise to reject")
  expect(rejection instanceof Error ? rejection.message : String(rejection)).toMatch(pattern)
}

describe("Task 9 edge-case hardening", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function tempDir(prefix: string) {
    const dir = mkdtempSync(join(tmpdir(), prefix))
    tempDirs.push(dir)
    return dir
  }

  test("path with spaces loads a plugin fixture and runs state commands from a spaced cwd", async () => {
    const workDir = tempDir("opencode autoresearch edge path ")
    const pluginDir = join(workDir, "plugin fixtures with spaces")
    const marker = join(workDir, "plugin loaded marker.txt")
    mkdirSync(pluginDir, { recursive: true })
    const pluginFile = join(pluginDir, "autoresearch plugin.ts")
    writeFileSync(
      pluginFile,
      `export default {
  id: ${JSON.stringify(PLUGIN_ID)},
  server: async () => {
    await Bun.write(${JSON.stringify(marker)}, "loaded from spaced path")
  },
}
`,
      "utf-8",
    )

    const loadedModule = await import(`${pathToFileURL(pluginFile).href}?task9=${Date.now()}`)
    const loadResults = await simulatePluginLoader([{ module: loadedModule }])

    expect(loadResults).toEqual([{ status: "loaded", id: PLUGIN_ID, active: true }])
    expect(readFileSync(marker, "utf-8")).toBe("loaded from spaced path")

    const stateDir = join(workDir, "state with spaces")
    const prompt = await runCli(["prompt-plan", "--state-dir", stateDir, "--session-id", "path-spaces", "--goal", "path spaces"], {
      cwd: workDir,
    })

    expect(prompt.exitCode).toBe(0)
    expect(prompt.stderr).toBe("")
    expect(parseJson(prompt.stdout)).toMatchObject({ ok: true, sessionId: "path-spaces", goal: "path spaces" })
    expect(readFileSync(join(stateDir, "path-spaces.json"), "utf-8")).toContain("path spaces")
    expect(existsSync(join(workDir, ".opencode-autoresearch"))).toBe(false)
  })

  test("oh-my-openagent absent or partially disabled fixtures still keep autoresearch ordered last among known agents", () => {
    expect(sortFixtureNames([applyCanonicalRuntimeListPrefix("autoresearch"), "local-agent"]).map(normalizeVisibleAgentName)).toEqual([
      "autoresearch",
      "local-agent",
    ])

    const partiallyEnabled = [
      applyCanonicalRuntimeListPrefix("atlas"),
      applyCanonicalRuntimeListPrefix("autoresearch"),
      applyCanonicalRuntimeListPrefix("sisyphus"),
    ]

    expect(sortFixtureNames(partiallyEnabled).map(normalizeVisibleAgentName)).toEqual(["sisyphus", "atlas", "autoresearch"])
  })

  test("existing user-defined autoresearch agent collisions are refused unless force is explicit", async () => {
    const configDir = tempDir("opencode-autoresearch-user-agent-")
    const target = join(configDir, "agent", "autoresearch.md")
    mkdirSync(join(configDir, "agent"), { recursive: true })
    writeFileSync(target, "user-defined autoresearch", "utf-8")

    const refused = await runCli(["install-agent", "--config-dir", configDir])

    expect(refused.exitCode).toBe(1)
    expect(refused.stdout).toBe("")
    expect(refused.stderr).toBe(`Agent already exists: ${target}\nUse --force to overwrite.\n`)
    expect(readFileSync(target, "utf-8")).toBe("user-defined autoresearch")

    const forced = await runCli(["install-agent", "--config-dir", configDir, "--force"])

    expect(forced.exitCode).toBe(0)
    expect(parseJson(forced.stdout)).toEqual({ ok: true, path: target, overwritten: true })
    expect(frontmatterName(readFileSync(packagedAgentPath, "utf-8"))).toBe(AUTORESEARCH_VISIBLE_NAME)
    expect(frontmatterName(readFileSync(target, "utf-8"))).toBe(`${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`)
  })

  test("disabled plugin entries with stale state do not activate server hooks", async () => {
    const workDir = tempDir("opencode-autoresearch-stale-disabled-")
    const marker = join(workDir, "stale-state.txt")
    writeFileSync(marker, "stale active marker", "utf-8")
    const module = {
      default: {
        id: PLUGIN_ID,
        server: async () => {
          await Bun.write(marker, "server unexpectedly activated")
        },
      },
    }

    const results = await simulatePluginLoader([{ module, enabled: false }])

    expect(results).toEqual([{ status: "disabled", id: PLUGIN_ID, active: false }])
    expect(readFileSync(marker, "utf-8")).toBe("stale active marker")
  })

  test("corrupt state is quarantined while future state is preserved for upgraded readers", async () => {
    const baseDir = tempDir("opencode-autoresearch-state-edges-")
    const store = createSessionStore({ baseDir, now: () => "2026-04-25T00:00:00.000Z" })
    const corruptPath = store.sessionPath("corrupt")
    const futurePath = store.sessionPath("future")
    writeFileSync(corruptPath, "{ not json", "utf-8")
    writeFileSync(futurePath, JSON.stringify({ schemaVersion: SESSION_SCHEMA_VERSION + 1, sessionId: "future" }), "utf-8")

    const recovered = await store.read("corrupt")

    expect(recovered.status).toBe("recovered")
    if (recovered.status === "recovered") {
      expect(readFileSync(recovered.corruptPath, "utf-8")).toBe("{ not json")
      expect(recovered.reason).toContain("Moved unreadable state")
    }
    expect(existsSync(corruptPath)).toBe(false)

    await expectRejects(store.read("future"), /Unsupported future session schema version/)
    expect(readFileSync(futurePath, "utf-8")).toBe(JSON.stringify({ schemaVersion: SESSION_SCHEMA_VERSION + 1, sessionId: "future" }))
  })

  test("repeated CLI runs reuse pending work and update logged metrics without duplicate state", async () => {
    const workDir = tempDir("opencode-autoresearch-repeated-runs-")
    const stateDir = join(workDir, "state")
    const baseArgs = ["--state-dir", stateDir, "--session-id", "repeat"]

    await runCli(["prompt-plan", ...baseArgs, "--goal", "repeat safely"], { cwd: workDir })
    const first = await runCli(["next-experiment", ...baseArgs, "--hypothesis", "first"], { cwd: workDir })
    const second = await runCli(["next-experiment", ...baseArgs, "--hypothesis", "second should wait"], { cwd: workDir })

    expect(first.exitCode).toBe(0)
    expect(second.exitCode).toBe(0)
    expect(parseJson(second.stdout)).toMatchObject({ reusedPending: true, experiment: { id: "exp-1", hypothesis: "first" } })

    await runCli([
      "log-experiment",
      ...baseArgs,
      "--experiment-id",
      "exp-1",
      "--status",
      "keep",
      "--metric-name",
      "score",
      "--metric-value",
      "1",
      "--metric-direction",
      "higher",
    ], { cwd: workDir })
    await runCli([
      "log-experiment",
      ...baseArgs,
      "--experiment-id",
      "exp-1",
      "--status",
      "keep",
      "--metric-name",
      "score",
      "--metric-value",
      "2",
      "--metric-direction",
      "higher",
    ], { cwd: workDir })

    const state = JSON.parse(readFileSync(join(stateDir, "repeat.json"), "utf-8"))
    expect(state.experiments).toHaveLength(1)
    expect(state.metrics).toEqual([{ name: "score", value: 2, direction: "higher", sourceExperimentId: "exp-1" }])
  })

  test("bounded package and README contracts exclude refer and preserve fallback discovery", async () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
    const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
    const configDir = tempDir("opencode-autoresearch-fallback-config-")

    expect(pkg.files).toEqual(["dist", "agent"])
    expect(pkg.files.some((entry: string) => entry.includes("refer"))).toBe(false)
    expect(pkg.scripts.test).toBe("bun test ./tests --path-ignore-patterns 'refer/**'")
    expect(pkg.scripts.check).toBe("bun run typecheck && bun run build && bun run test")
    expect(readme).toContain("Package-level OpenCode agent discovery from the package alone is not asserted by this repo")
    expect(readme).toContain("fallback `install-agent --config-dir <dir>` path is tested and works regardless")

    const copied = await copyAutoresearchAgent(configDir)

    expect(copied).toBe(join(configDir, "agent", "autoresearch.md"))
    expect(frontmatterName(readFileSync(packagedAgentPath, "utf-8"))).toBe(AUTORESEARCH_VISIBLE_NAME)
    expect(frontmatterName(readFileSync(copied, "utf-8"))).toBe(`${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`)
  })
})
