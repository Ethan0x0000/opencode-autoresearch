import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join, resolve } from "path"

const repoRoot = resolve(import.meta.dir, "..")
const cliPath = join(repoRoot, "src", "cli.ts")

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

function readState(stateDir: string, sessionId: string) {
  return JSON.parse(readFileSync(join(stateDir, `${sessionId}.json`), "utf-8"))
}

describe("minimal autoresearch workflow behavior", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function tempDir(prefix: string) {
    const dir = mkdtempSync(join(tmpdir(), prefix))
    tempDirs.push(dir)
    return dir
  }

  test("happy path loop records state, exports snapshots, and previews finalization without source mutation", async () => {
    const workDir = tempDir("opencode-autoresearch-workflow-")
    const stateDir = join(workDir, "state")
    const sessionId = "happy-path"
    const baseArgs = ["--state-dir", stateDir, "--session-id", sessionId]
    const sourcePath = join(workDir, "train.py")
    writeFileSync(sourcePath, "print('baseline')\n", "utf-8")

    const prompt = await runCli([
      "prompt-plan",
      ...baseArgs,
      "--goal",
      "Lower validation bits per byte",
      "--constraints",
      "no external services,keep exports static",
    ])
    expect(prompt.exitCode).toBe(0)
    expect(parseJson(prompt.stdout)).toMatchObject({
      ok: true,
      goal: "Lower validation bits per byte",
      constraints: ["no external services", "keep exports static"],
    })

    const setup = await runCli([
      "setup-plan",
      ...baseArgs,
      "--checklist",
      "Install deps,Run baseline",
      "--notes",
      "GPU runner is available",
    ])
    expect(setup.exitCode).toBe(0)
    expect(parseJson(setup.stdout)).toMatchObject({ checklist: ["Install deps", "Run baseline"] })

    const onboarding = await runCli(["onboarding-packet", ...baseArgs])
    expect(onboarding.exitCode).toBe(0)
    expect(parseJson(onboarding.stdout).summary).toContain("Lower validation bits per byte")
    expect(parseJson(onboarding.stdout).summary).toContain("Install deps")

    const firstRecommendation = await runCli(["recommend-next", ...baseArgs])
    const secondRecommendation = await runCli(["recommend-next", ...baseArgs])
    expect(firstRecommendation.exitCode).toBe(0)
    expect(secondRecommendation.exitCode).toBe(0)
    expect(parseJson(secondRecommendation.stdout).recommendation.id).toBe(parseJson(firstRecommendation.stdout).recommendation.id)
    expect(readState(stateDir, sessionId).recommendations).toHaveLength(1)

    const next = await runCli(["next-experiment", ...baseArgs])
    expect(next.exitCode).toBe(0)
    const nextPayload = parseJson(next.stdout)
    expect(nextPayload.experiment).toMatchObject({ id: "exp-1", status: "pending" })
    expect(readState(stateDir, sessionId).experiments).toHaveLength(1)

    const checks = await runCli(["checks-inspect", ...baseArgs, "--summary", "bun test passed"])
    expect(checks.exitCode).toBe(0)
    expect(parseJson(checks.stdout).checkSummary).toBe("bun test passed")

    const lint = await runCli([
      "benchmark-lint",
      ...baseArgs,
      "--metric-name",
      "val_bpb",
      "--metric-direction",
      "lower",
      "--command",
      "bun test",
    ])
    expect(lint.exitCode).toBe(0)
    expect(parseJson(lint.stdout)).toMatchObject({ valid: true, missingFields: [] })

    const logged = await runCli([
      "log-experiment",
      ...baseArgs,
      "--experiment-id",
      nextPayload.experiment.id,
      "--status",
      "keep",
      "--metric-name",
      "val_bpb",
      "--metric-value",
      "0.97",
      "--metric-direction",
      "lower",
      "--result",
      "improved baseline",
      "--evidence",
      "METRIC val_bpb=0.97",
    ])
    expect(logged.exitCode).toBe(0)
    expect(parseJson(logged.stdout).experiment).toMatchObject({ id: "exp-1", status: "keep" })
    expect(readState(stateDir, sessionId).metrics).toEqual([
      { name: "val_bpb", value: 0.97, direction: "lower", sourceExperimentId: "exp-1" },
    ])

    const exportDir = join(workDir, "snapshots")
    const exported = await runCli(["export-dashboard", ...baseArgs, "--output-dir", exportDir])
    expect(exported.exitCode).toBe(0)
    const exportPayload = parseJson(exported.stdout)
    expect(exportPayload.staticSnapshotOnly).toBe(true)
    expect(existsSync(exportPayload.jsonPath)).toBe(true)
    expect(existsSync(exportPayload.markdownPath)).toBe(true)
    expect(readFileSync(exportPayload.markdownPath, "utf-8")).toContain("Lower validation bits per byte")

    const beforeSource = readFileSync(sourcePath, "utf-8")
    const preview = await runCli(["finalize-preview", ...baseArgs, "--cwd", workDir])
    expect(preview.exitCode).toBe(0)
    expect(parseJson(preview.stdout)).toMatchObject({ pendingCount: 0, completeCount: 1 })
    expect(readFileSync(sourcePath, "utf-8")).toBe(beforeSource)
  })

  test("invalid metric logging is rejected without mutating state", async () => {
    const workDir = tempDir("opencode-autoresearch-invalid-metric-")
    const stateDir = join(workDir, "state")
    const sessionId = "invalid-metric"
    const baseArgs = ["--state-dir", stateDir, "--session-id", sessionId]

    await runCli(["prompt-plan", ...baseArgs, "--goal", "Measure safely"])
    await runCli(["setup-plan", ...baseArgs, "--checklist", "Run baseline"])
    await runCli(["next-experiment", ...baseArgs, "--hypothesis", "Baseline"])
    const before = readFileSync(join(stateDir, `${sessionId}.json`), "utf-8")

    const missingId = await runCli([
      "log-experiment",
      ...baseArgs,
      "--status",
      "keep",
      "--metric-name",
      "score",
      "--metric-value",
      "1",
      "--metric-direction",
      "higher",
    ])
    expect(missingId.exitCode).toBe(1)
    expect(missingId.stderr).toContain("experiment id")
    expect(readFileSync(join(stateDir, `${sessionId}.json`), "utf-8")).toBe(before)

    const invalidDirection = await runCli([
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
      "sideways",
    ])
    expect(invalidDirection.exitCode).toBe(1)
    expect(invalidDirection.stderr).toContain("metric direction")
    expect(readFileSync(join(stateDir, `${sessionId}.json`), "utf-8")).toBe(before)
  })

  test("doctor-session reports missing goal, setup, stale experiments, and corrupt recovery", async () => {
    const stateDir = join(tempDir("opencode-autoresearch-doctor-"), "state")
    const sessionId = "doctor"
    const baseArgs = ["--state-dir", stateDir, "--session-id", sessionId]

    const emptyDoctor = await runCli(["doctor-session", ...baseArgs])
    expect(emptyDoctor.exitCode).toBe(0)
    expect(parseJson(emptyDoctor.stdout).issues.map((issue: { code: string }) => issue.code)).toEqual([
      "missing_goal",
      "missing_setup",
    ])

    await runCli(["prompt-plan", ...baseArgs, "--goal", "Diagnose stale state"])
    await runCli(["setup-plan", ...baseArgs, "--checklist", "Run baseline"])
    await runCli(["next-experiment", ...baseArgs, "--hypothesis", "A pending run"])

    const staleDoctor = await runCli(["doctor-session", ...baseArgs])
    expect(staleDoctor.exitCode).toBe(0)
    expect(parseJson(staleDoctor.stdout).issues.map((issue: { code: string }) => issue.code)).toContain("stale_experiments")

    const corruptSession = "corrupt"
    writeFileSync(join(stateDir, `${corruptSession}.json`), "{ not json", "utf-8")
    const corruptDoctor = await runCli(["doctor-session", "--state-dir", stateDir, "--session-id", corruptSession])
    expect(corruptDoctor.exitCode).toBe(0)
    expect(parseJson(corruptDoctor.stdout).issues.map((issue: { code: string }) => issue.code)).toContain("corrupt_recovery")
  })
})
