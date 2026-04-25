// @bun
// src/session/schema.ts
var SESSION_SCHEMA_VERSION = 1;
var SESSION_STATUSES = ["new", "setup", "running", "complete", "blocked"];
var EXPERIMENT_STATUSES = ["pending", "keep", "discard", "crash", "checks_failed"];
var METRIC_DIRECTIONS = ["higher", "lower"];
function createInitialSessionState(input, timestamp) {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: input.sessionId,
    goal: input.goal ?? "",
    setup: {
      checklist: input.setup?.checklist ?? [],
      notes: input.setup?.notes ?? ""
    },
    status: input.status ?? "new",
    createdAt: timestamp,
    updatedAt: timestamp,
    experiments: [],
    metrics: [],
    recommendations: [],
    notes: []
  };
}
function parseSessionState(value) {
  if (!isRecord(value))
    return corrupt("Session state must be a JSON object");
  const schemaVersion = value.schemaVersion;
  if (typeof schemaVersion === "number" && schemaVersion > SESSION_SCHEMA_VERSION) {
    return {
      ok: false,
      kind: "future-version",
      version: schemaVersion,
      reason: `Unsupported future session schema version ${schemaVersion}; supported version is ${SESSION_SCHEMA_VERSION}`
    };
  }
  if (schemaVersion !== SESSION_SCHEMA_VERSION) {
    return corrupt(`Session schemaVersion must be ${SESSION_SCHEMA_VERSION}`);
  }
  const sessionId = requiredString(value, "sessionId");
  const goal = requiredString(value, "goal");
  const setup = parseSetup(value.setup);
  const status = parseEnum(value.status, SESSION_STATUSES, "status");
  const createdAt = requiredString(value, "createdAt");
  const updatedAt = requiredString(value, "updatedAt");
  const experiments = parseArray(value.experiments, parseExperiment, "experiments");
  const metrics = parseArray(value.metrics, parseMetric, "metrics");
  const recommendations = parseArray(value.recommendations, parseRecommendation, "recommendations");
  const notes = parseArray(value.notes, parseNote, "notes");
  const failure = firstFailure([
    sessionId,
    goal,
    setup,
    status,
    createdAt,
    updatedAt,
    experiments,
    metrics,
    recommendations,
    notes
  ]);
  if (failure)
    return corrupt(failure);
  return {
    ok: true,
    state: {
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: fieldValue(sessionId),
      goal: fieldValue(goal),
      setup: fieldValue(setup),
      status: fieldValue(status),
      createdAt: fieldValue(createdAt),
      updatedAt: fieldValue(updatedAt),
      experiments: fieldValue(experiments),
      metrics: fieldValue(metrics),
      recommendations: fieldValue(recommendations),
      notes: fieldValue(notes)
    }
  };
}
function createExperiment(input, timestamp) {
  return {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requiredString(record, key) {
  const value = record[key];
  if (typeof value !== "string")
    return { ok: false, reason: `${key} must be a string` };
  return { ok: true, value };
}
function optionalString(record, key) {
  const value = record[key];
  if (value === undefined)
    return { ok: true, value: undefined };
  if (typeof value !== "string")
    return { ok: false, reason: `${key} must be a string when present` };
  return { ok: true, value };
}
function parseSetup(value) {
  if (!isRecord(value))
    return { ok: false, reason: "setup must be an object" };
  const checklist = parseStringArray(value.checklist, "setup.checklist");
  const notes = requiredString(value, "notes");
  const failure = firstFailure([checklist, notes]);
  if (failure)
    return { ok: false, reason: failure };
  return { ok: true, value: { checklist: fieldValue(checklist), notes: fieldValue(notes) } };
}
function parseStringArray(value, key) {
  if (!Array.isArray(value))
    return { ok: false, reason: `${key} must be an array` };
  if (!value.every((item) => typeof item === "string")) {
    return { ok: false, reason: `${key} must contain only strings` };
  }
  return { ok: true, value };
}
function parseMetric(value) {
  if (!isRecord(value))
    return { ok: false, reason: "metric must be an object" };
  const name = requiredString(value, "name");
  const metricValue = finiteNumber(value.value, "value");
  const direction = parseEnum(value.direction, METRIC_DIRECTIONS, "direction");
  const unit = optionalString(value, "unit");
  const sourceExperimentId = optionalString(value, "sourceExperimentId");
  const failure = firstFailure([name, metricValue, direction, unit, sourceExperimentId]);
  if (failure)
    return { ok: false, reason: failure };
  const metric = {
    name: fieldValue(name),
    value: fieldValue(metricValue),
    direction: fieldValue(direction)
  };
  const unitValue = fieldValue(unit);
  const sourceExperimentIdValue = fieldValue(sourceExperimentId);
  if (unitValue !== undefined)
    metric.unit = unitValue;
  if (sourceExperimentIdValue !== undefined)
    metric.sourceExperimentId = sourceExperimentIdValue;
  return { ok: true, value: metric };
}
function parseExperiment(value) {
  if (!isRecord(value))
    return { ok: false, reason: "experiment must be an object" };
  const id = requiredString(value, "id");
  const run = finiteInteger(value.run, "run");
  const hypothesis = requiredString(value, "hypothesis");
  const status = parseEnum(value.status, EXPERIMENT_STATUSES, "status");
  const createdAt = requiredString(value, "createdAt");
  const updatedAt = requiredString(value, "updatedAt");
  const metric = value.metric === undefined ? ok(undefined) : parseMetric(value.metric);
  const evidence = optionalString(value, "evidence");
  const rollbackReason = optionalString(value, "rollbackReason");
  const nextActionHint = optionalString(value, "nextActionHint");
  const failure = firstFailure([
    id,
    run,
    hypothesis,
    status,
    createdAt,
    updatedAt,
    metric,
    evidence,
    rollbackReason,
    nextActionHint
  ]);
  if (failure)
    return { ok: false, reason: failure };
  const experiment = {
    id: fieldValue(id),
    run: fieldValue(run),
    hypothesis: fieldValue(hypothesis),
    status: fieldValue(status),
    createdAt: fieldValue(createdAt),
    updatedAt: fieldValue(updatedAt)
  };
  const metricValue = fieldValue(metric);
  const evidenceValue = fieldValue(evidence);
  const rollbackReasonValue = fieldValue(rollbackReason);
  const nextActionHintValue = fieldValue(nextActionHint);
  if (metricValue !== undefined)
    experiment.metric = metricValue;
  if (evidenceValue !== undefined)
    experiment.evidence = evidenceValue;
  if (rollbackReasonValue !== undefined)
    experiment.rollbackReason = rollbackReasonValue;
  if (nextActionHintValue !== undefined)
    experiment.nextActionHint = nextActionHintValue;
  return { ok: true, value: experiment };
}
function parseRecommendation(value) {
  if (!isRecord(value))
    return { ok: false, reason: "recommendation must be an object" };
  const id = requiredString(value, "id");
  const summary = requiredString(value, "summary");
  const createdAt = requiredString(value, "createdAt");
  const rationale = optionalString(value, "rationale");
  const failure = firstFailure([id, summary, createdAt, rationale]);
  if (failure)
    return { ok: false, reason: failure };
  const recommendation = {
    id: fieldValue(id),
    summary: fieldValue(summary),
    createdAt: fieldValue(createdAt)
  };
  const rationaleValue = fieldValue(rationale);
  if (rationaleValue !== undefined)
    recommendation.rationale = rationaleValue;
  return { ok: true, value: recommendation };
}
function parseNote(value) {
  if (!isRecord(value))
    return { ok: false, reason: "note must be an object" };
  const id = requiredString(value, "id");
  const text = requiredString(value, "text");
  const createdAt = requiredString(value, "createdAt");
  const failure = firstFailure([id, text, createdAt]);
  if (failure)
    return { ok: false, reason: failure };
  return { ok: true, value: { id: fieldValue(id), text: fieldValue(text), createdAt: fieldValue(createdAt) } };
}
function parseArray(value, parseItem, key) {
  if (!Array.isArray(value))
    return { ok: false, reason: `${key} must be an array` };
  const parsed = [];
  for (const item of value) {
    const result = parseItem(item);
    if (!result.ok)
      return { ok: false, reason: `${key}: ${result.reason}` };
    parsed.push(result.value);
  }
  return { ok: true, value: parsed };
}
function finiteNumber(value, key) {
  if (typeof value !== "number" || !Number.isFinite(value))
    return { ok: false, reason: `${key} must be a finite number` };
  return { ok: true, value };
}
function finiteInteger(value, key) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, reason: `${key} must be a non-negative integer` };
  }
  return { ok: true, value };
}
function parseEnum(value, allowed, key) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return { ok: false, reason: `${key} must be one of: ${allowed.join(", ")}` };
  }
  return { ok: true, value };
}
function ok(value) {
  return { ok: true, value };
}
function fieldValue(result) {
  if (!result.ok)
    throw new Error(result.reason);
  return result.value;
}
function corrupt(reason) {
  return { ok: false, kind: "corrupt", reason };
}
function firstFailure(results) {
  return results.find((result) => !result.ok)?.reason;
}

// src/commands/doctor.ts
var doctorHandlers = {
  "doctor-session": async (context) => {
    const read = await context.store.read(context.sessionId);
    const recoveredIssue = read.status === "recovered" ? { code: "corrupt_recovery", message: read.reason } : undefined;
    const state = read.status === "ready" ? read.state : await context.store.create({ sessionId: context.sessionId });
    const issues = doctorIssues(state, recoveredIssue);
    return stateContract(context, "doctor", {
      healthy: issues.length === 0,
      issues,
      pendingCount: state.experiments.filter((experiment) => experiment.status === "pending").length
    });
  },
  "checks-inspect": async (context) => {
    const state = await ensureSession(context);
    const summary = optionString(context.args, "summary") ?? optionString(context.args, "output") ?? context.args._.join(" ").trim();
    const saved = summary ? await context.store.save({ ...state, notes: upsertNote(state.notes, "checks-inspect", summary) }) : state;
    return stateContract(context, "doctor", {
      checkSummary: summary || "",
      recorded: summary.length > 0,
      noteCount: saved.notes.length
    });
  },
  "benchmark-lint": async (context) => {
    const metricName = optionString(context.args, "metric-name") ?? optionString(context.args, "metricName");
    const metricDirection = optionString(context.args, "metric-direction") ?? optionString(context.args, "metricDirection");
    const command = optionString(context.args, "command");
    const missingFields = [
      ["metric-name", metricName],
      ["metric-direction", metricDirection],
      ["command", command]
    ].filter(([, value]) => !value).map(([field]) => field);
    let normalizedDirection;
    if (metricDirection)
      normalizedDirection = parseMetricDirection(metricDirection);
    return stateContract(context, "doctor", {
      valid: missingFields.length === 0,
      missingFields,
      metricName: metricName ?? null,
      metricDirection: normalizedDirection ?? null,
      benchmarkCommand: command ?? null
    });
  }
};
async function ensureSession(context) {
  const existing = await context.store.read(context.sessionId);
  if (existing.status === "ready")
    return existing.state;
  return context.store.create({ sessionId: context.sessionId });
}
function doctorIssues(state, recoveredIssue) {
  const issues = [];
  if (recoveredIssue)
    issues.push(recoveredIssue);
  if (!state.goal.trim())
    issues.push({ code: "missing_goal", message: "Record a goal with prompt-plan." });
  if (state.setup.checklist.length === 0) {
    issues.push({ code: "missing_setup", message: "Record setup checklist items with setup-plan." });
  }
  const pending = state.experiments.filter((experiment) => experiment.status === "pending");
  if (pending.length > 0) {
    issues.push({
      code: "stale_experiments",
      message: `Log or resolve pending experiments: ${pending.map((experiment) => experiment.id).join(", ")}`
    });
  }
  return issues;
}
function upsertNote(notes, id, text) {
  const note = { id, text, createdAt: new Date().toISOString() };
  const index = notes.findIndex((candidate) => candidate.id === id);
  if (index === -1)
    return [...notes, note];
  return [...notes.slice(0, index), { ...note, createdAt: notes[index].createdAt }, ...notes.slice(index + 1)];
}
function parseMetricDirection(value) {
  if (METRIC_DIRECTIONS.includes(value))
    return value;
  throw new Error(`Invalid metric direction: ${value}. Expected one of ${METRIC_DIRECTIONS.join(", ")}`);
}

// src/commands/export.ts
import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
var exportHandlers = {
  "export-dashboard": async (context) => {
    const state = await ensureSession2(context);
    const outputDir = resolve(optionString(context.args, "output-dir") ?? optionString(context.args, "outputDir") ?? context.store.baseDir);
    await mkdir(outputDir, { recursive: true });
    const snapshot = dashboardSnapshot(state);
    const jsonPath = join(outputDir, `${context.sessionId}-dashboard.json`);
    const markdownPath = join(outputDir, `${context.sessionId}-dashboard.md`);
    await writeFile(jsonPath, `${JSON.stringify(snapshot, null, 2)}
`, "utf-8");
    await writeFile(markdownPath, dashboardMarkdown(snapshot), "utf-8");
    return stateContract(context, "export", {
      staticSnapshotOnly: true,
      jsonPath,
      markdownPath,
      snapshot
    });
  },
  "finalize-preview": async (context) => {
    const state = await ensureSession2(context);
    const pendingCount = state.experiments.filter((experiment) => experiment.status === "pending").length;
    const completeCount = state.experiments.filter((experiment) => experiment.status !== "pending").length;
    return stateContract(context, "export", {
      pendingCount,
      completeCount,
      wouldMutateSourceFiles: false,
      nextAction: pendingCount > 0 ? "Log or discard pending experiments before finalizing." : "Review kept experiments before any manual finalization."
    });
  }
};
async function ensureSession2(context) {
  const existing = await context.store.read(context.sessionId);
  if (existing.status === "ready")
    return existing.state;
  return context.store.create({ sessionId: context.sessionId });
}
function dashboardSnapshot(state) {
  const pendingCount = state.experiments.filter((experiment) => experiment.status === "pending").length;
  const completeCount = state.experiments.filter((experiment) => experiment.status !== "pending").length;
  return {
    generatedAt: new Date().toISOString(),
    deliveryMode: "static-export",
    sessionId: state.sessionId,
    goal: state.goal,
    setup: state.setup,
    pendingCount,
    completeCount,
    experiments: state.experiments,
    metrics: state.metrics,
    recommendations: state.recommendations,
    notes: state.notes
  };
}
function dashboardMarkdown(snapshot) {
  const lines = [
    `# Autoresearch Dashboard Snapshot: ${snapshot.sessionId}`,
    "",
    "Static snapshot only; this file does not run commands or start a server.",
    "",
    `- Goal: ${snapshot.goal || "not recorded"}`,
    `- Pending experiments: ${snapshot.pendingCount}`,
    `- Complete experiments: ${snapshot.completeCount}`,
    `- Setup checklist: ${snapshot.setup.checklist.length > 0 ? snapshot.setup.checklist.join("; ") : "not recorded"}`,
    "",
    "## Experiments",
    ""
  ];
  if (snapshot.experiments.length === 0)
    lines.push("No experiments recorded.");
  for (const experiment of snapshot.experiments) {
    lines.push(`- ${experiment.id}: ${experiment.status} \u2014 ${experiment.hypothesis}`);
  }
  lines.push("");
  return `${lines.join(`
`)}
`;
}

// src/commands/install-agent.ts
import { constants } from "fs";
import { access, lstat, mkdir as mkdir2, readFile, rename, rm, writeFile as writeFile2 } from "fs/promises";
import { dirname, join as join2, resolve as resolve2 } from "path";

// src/compat/zero-width.ts
var ZERO_WIDTH_SPACE = "\u200B";
var AUTORESEARCH_PREFIX_COUNT = 5;
var AUTORESEARCH_SORT_PREFIX = ZERO_WIDTH_SPACE.repeat(AUTORESEARCH_PREFIX_COUNT);
var AUTORESEARCH_VISIBLE_NAME = "autoresearch";

// src/compat/installed-agent.ts
var CANONICAL_NAME_LINE = `name: ${AUTORESEARCH_VISIBLE_NAME}`;
var INSTALLED_NAME_LINE = `name: ${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`;
function renderInstalledAutoresearchAgent(packagedContent) {
  const installedContent = packagedContent.replace(/^name: autoresearch$/m, INSTALLED_NAME_LINE);
  if (installedContent === packagedContent) {
    throw new Error(`Packaged agent asset missing canonical frontmatter line: ${CANONICAL_NAME_LINE}`);
  }
  return installedContent;
}

// src/commands/install-agent.ts
var installAgentCommand = async (context) => {
  const configDir = optionString(context.args, "config-dir");
  if (configDir === undefined)
    throw new Error("Missing required option: --config-dir");
  const agentDir = join2(resolve2(configDir), "agent");
  await rejectSymlink(resolve2(configDir));
  await rejectSymlink(agentDir);
  await mkdir2(agentDir, { recursive: true });
  await rejectSymlink(agentDir);
  const target = join2(agentDir, "autoresearch.md");
  const targetState = await pathState(target);
  if (targetState === "symlink")
    throw new Error(`Refusing to write through symlink: ${target}`);
  if (targetState === "directory")
    throw new Error(`Refusing to overwrite directory: ${target}`);
  if (targetState === "file" && !optionBoolean(context.args, "force")) {
    throw new Error(`Agent already exists: ${target}
Use --force to overwrite.`);
  }
  await copyAgentFile(target, targetState === "file");
  return { ok: true, path: target, overwritten: targetState === "file" };
};
async function packagedAgentPath() {
  const candidates = [
    join2(import.meta.dir, "..", "agent", "autoresearch.md"),
    join2(import.meta.dir, "..", "..", "agent", "autoresearch.md")
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate))
      return candidate;
  }
  throw new Error("Packaged agent asset not found: agent/autoresearch.md");
}
async function copyAgentFile(target, overwrite) {
  const source = renderInstalledAutoresearchAgent(await readFile(await packagedAgentPath(), "utf-8"));
  if (!overwrite) {
    await writeFile2(target, source, { flag: constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY });
    return;
  }
  const tempPath = join2(dirname(target), `.autoresearch.md.tmp-${process.pid}-${Date.now()}`);
  try {
    await writeFile2(tempPath, source, { flag: constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY });
    await rename(tempPath, target);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}
async function rejectSymlink(path) {
  const state = await pathState(path);
  if (state === "symlink")
    throw new Error(`Refusing to write through symlink: ${path}`);
}
async function pathState(path) {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink())
      return "symlink";
    if (stats.isDirectory())
      return "directory";
    return "file";
  } catch (error) {
    if (isFileNotFound(error))
      return "missing";
    throw error;
  }
}
async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
function isFileNotFound(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

// src/commands/intake.ts
var intakeHandlers = {
  "prompt-plan": async (context) => {
    const state = await ensureSession3(context);
    const goal = optionString(context.args, "goal") ?? context.args._.join(" ").trim();
    const constraints = optionList(context.args, "constraints", "constraint");
    const nextState = {
      ...state,
      goal: goal || state.goal,
      notes: constraints.length > 0 ? upsertNote2(state.notes, "constraints", constraints.join(`
`)) : state.notes
    };
    const saved = await context.store.save(nextState);
    return stateContract(context, "intake", {
      goal: saved.goal,
      constraints: constraintsFromState(saved),
      status: saved.status
    });
  },
  "setup-plan": async (context) => {
    const state = await ensureSession3(context);
    const checklist = optionList(context.args, "checklist", "check");
    const notes = optionString(context.args, "notes") ?? optionString(context.args, "setup-notes");
    const saved = await context.store.save({
      ...state,
      setup: {
        checklist: checklist.length > 0 ? checklist : state.setup.checklist,
        notes: notes ?? state.setup.notes
      },
      status: "setup"
    });
    return stateContract(context, "intake", {
      checklist: saved.setup.checklist,
      setupNotes: saved.setup.notes,
      status: saved.status
    });
  },
  "onboarding-packet": async (context) => {
    const state = await ensureSession3(context);
    const constraints = constraintsFromState(state);
    const checklist = state.setup.checklist;
    const summary = [
      `Goal: ${state.goal || "not recorded"}`,
      `Constraints: ${constraints.length > 0 ? constraints.join("; ") : "none recorded"}`,
      `Setup: ${checklist.length > 0 ? checklist.join("; ") : "not recorded"}`,
      `Experiments: ${state.experiments.length}`
    ].join(`
`);
    return stateContract(context, "intake", {
      summary,
      goal: state.goal,
      constraints,
      checklist,
      experimentCount: state.experiments.length
    });
  }
};
async function ensureSession3(context) {
  const existing = await context.store.read(context.sessionId);
  if (existing.status === "ready")
    return existing.state;
  return context.store.create({ sessionId: context.sessionId });
}
function optionList(options, ...keys) {
  for (const key of keys) {
    const value = options[key];
    if (Array.isArray(value))
      return value.flatMap(splitList);
    if (typeof value === "string")
      return splitList(value);
  }
  return [];
}
function splitList(value) {
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}
function upsertNote2(notes, id, text) {
  const note = { id, text, createdAt: new Date().toISOString() };
  const index = notes.findIndex((candidate) => candidate.id === id);
  if (index === -1)
    return [...notes, note];
  return [...notes.slice(0, index), { ...note, createdAt: notes[index].createdAt }, ...notes.slice(index + 1)];
}
function constraintsFromState(state) {
  const note = state.notes.find((candidate) => candidate.id === "constraints");
  return note ? splitList(note.text) : [];
}

// src/commands/loop.ts
var loopHandlers = {
  "next-experiment": async (context) => {
    const state = await ensureSession4(context);
    const pending = state.experiments.find((experiment2) => experiment2.status === "pending");
    if (pending) {
      return stateContract(context, "loop", { experiment: pending, reusedPending: true });
    }
    const recommendation = state.recommendations.at(-1);
    const run = state.experiments.length + 1;
    const id = `exp-${run}`;
    const hypothesis = optionString(context.args, "hypothesis") ?? recommendation?.summary ?? "Run one baseline measurement.";
    const saved = await context.store.appendExperiment(context.sessionId, {
      id,
      run,
      hypothesis,
      status: "pending",
      nextActionHint: "Run the experiment, then log its metric and status."
    });
    const experiment = saved.experiments.find((candidate) => candidate.id === id);
    return stateContract(context, "loop", { experiment, reusedPending: false });
  },
  "log-experiment": async (context) => {
    const experimentId = optionString(context.args, "experiment-id") ?? optionString(context.args, "experimentId");
    if (!experimentId) {
      if (hasLogInput(context))
        throw new Error("Missing experiment id for log-experiment");
      return stateContract(context, "loop", { requiresExperimentId: true });
    }
    const state = await ensureSession4(context);
    const experiment = state.experiments.find((candidate) => candidate.id === experimentId);
    if (!experiment)
      throw new Error(`Unknown experiment id: ${experimentId}`);
    const status = parseStatus(optionString(context.args, "status") ?? experiment.status);
    const metric = parseMetric2(context, experimentId);
    const saved = await context.store.appendExperiment(context.sessionId, {
      id: experiment.id,
      run: experiment.run,
      hypothesis: optionString(context.args, "hypothesis") ?? experiment.hypothesis,
      status,
      metric,
      evidence: optionString(context.args, "evidence") ?? optionString(context.args, "result") ?? experiment.evidence,
      rollbackReason: optionString(context.args, "rollback-reason") ?? optionString(context.args, "rollbackReason") ?? experiment.rollbackReason,
      nextActionHint: optionString(context.args, "next-action-hint") ?? optionString(context.args, "nextActionHint") ?? experiment.nextActionHint
    });
    const updated = saved.experiments.find((candidate) => candidate.id === experiment.id);
    return stateContract(context, "loop", { experiment: updated, metric });
  }
};
async function ensureSession4(context) {
  const existing = await context.store.read(context.sessionId);
  if (existing.status === "ready")
    return existing.state;
  return context.store.create({ sessionId: context.sessionId });
}
function hasLogInput(context) {
  return ["status", "metric-name", "metricName", "metric-value", "metricValue", "metric-direction", "metricDirection", "result", "evidence"].some((key) => context.args[key] !== undefined);
}
function parseStatus(value) {
  if (EXPERIMENT_STATUSES.includes(value))
    return value;
  throw new Error(`Invalid experiment status: ${value}. Expected one of ${EXPERIMENT_STATUSES.join(", ")}`);
}
function parseMetric2(context, experimentId) {
  const name = optionString(context.args, "metric-name") ?? optionString(context.args, "metricName");
  const rawValue = optionString(context.args, "metric-value") ?? optionString(context.args, "metricValue");
  const rawDirection = optionString(context.args, "metric-direction") ?? optionString(context.args, "metricDirection");
  const unit = optionString(context.args, "metric-unit") ?? optionString(context.args, "metricUnit");
  const hasMetricInput = name !== undefined || rawValue !== undefined || rawDirection !== undefined || unit !== undefined;
  if (!hasMetricInput)
    return;
  if (!name)
    throw new Error("Missing metric name for log-experiment");
  if (rawValue === undefined)
    throw new Error("Missing metric value for log-experiment");
  const value = Number(rawValue);
  if (!Number.isFinite(value))
    throw new Error(`Metric value must be finite: ${rawValue}`);
  const direction = parseMetricDirection2(rawDirection);
  return unit ? { name, value, direction, unit, sourceExperimentId: experimentId } : { name, value, direction, sourceExperimentId: experimentId };
}
function parseMetricDirection2(value) {
  if (value !== undefined && METRIC_DIRECTIONS.includes(value))
    return value;
  throw new Error(`Invalid metric direction: ${value ?? "missing"}. Expected one of ${METRIC_DIRECTIONS.join(", ")}`);
}

// src/commands/recommend.ts
var recommendHandlers = {
  "recommend-next": async (context) => {
    const state = await ensureSession5(context);
    const recommendation = buildRecommendation(state);
    const existing = state.recommendations.find((candidate) => candidate.id === recommendation.id);
    const saved = existing ? state : await context.store.save({ ...state, recommendations: [...state.recommendations, recommendation] });
    return stateContract(context, "recommend", {
      recommendation: existing ?? recommendation,
      recommendationCount: saved.recommendations.length
    });
  }
};
async function ensureSession5(context) {
  const existing = await context.store.read(context.sessionId);
  if (existing.status === "ready")
    return existing.state;
  return context.store.create({ sessionId: context.sessionId });
}
function buildRecommendation(state) {
  const pending = state.experiments.find((experiment) => experiment.status === "pending");
  const completeCount = state.experiments.filter((experiment) => experiment.status !== "pending").length;
  const fingerprint = `${state.experiments.length}-${completeCount}-${state.metrics.length}-${pending?.id ?? "none"}`;
  const id = `rec-${fingerprint}`;
  if (pending) {
    return {
      id,
      summary: `Log the result for ${pending.id} before starting another experiment.`,
      rationale: "A pending experiment is the safest next action because it preserves one stable lifecycle.",
      createdAt: new Date().toISOString()
    };
  }
  if (state.experiments.length === 0) {
    return {
      id,
      summary: "Run one baseline experiment with the current setup.",
      rationale: "A baseline gives future experiments a measured comparison point.",
      createdAt: new Date().toISOString()
    };
  }
  return {
    id,
    summary: "Try one small measured change against the current best result.",
    rationale: "Small reversible changes are safe after at least one logged result.",
    createdAt: new Date().toISOString()
  };
}

// src/session/store.ts
import { closeSync, fsyncSync, openSync } from "fs";
import { mkdir as mkdir3, open, readFile as readFile2, rename as rename2, rm as rm2 } from "fs/promises";
import { basename, dirname as dirname2, join as join3, resolve as resolve3 } from "path";
var DEFAULT_SESSION_BASE_DIR = resolve3(process.cwd(), ".opencode-autoresearch");
var atomicWriteCounter = 0;

class FutureSessionSchemaVersionError extends Error {
  constructor(version, filePath) {
    super(`Unsupported future session schema version ${version}; this plugin supports version ${SESSION_SCHEMA_VERSION}. Upgrade opencode-autoresearch before reading ${filePath}.`);
    this.name = "FutureSessionSchemaVersionError";
  }
}
function createSessionStore(options = {}) {
  const baseDir = resolve3(options.baseDir ?? DEFAULT_SESSION_BASE_DIR);
  const now = options.now ?? (() => new Date().toISOString());
  const sessionPath = (sessionId) => join3(baseDir, `${assertSafeSessionId(sessionId)}.json`);
  const read = async (sessionId) => {
    const path = sessionPath(sessionId);
    let raw;
    try {
      raw = await readFile2(path, "utf-8");
    } catch (error) {
      if (isFileNotFound2(error))
        return { status: "missing", path };
      throw error;
    }
    let parsedJson;
    try {
      parsedJson = JSON.parse(raw);
    } catch (error) {
      return quarantineCorruptFile(path, `Corrupt session state JSON: ${errorMessage(error)}`, now);
    }
    const parsed = parseSessionState(parsedJson);
    if (!parsed.ok) {
      if (parsed.kind === "future-version")
        throw new FutureSessionSchemaVersionError(parsed.version, path);
      return quarantineCorruptFile(path, `Corrupt session state shape: ${parsed.reason}`, now);
    }
    if (parsed.state.sessionId !== sessionId) {
      return quarantineCorruptFile(path, `Corrupt session state shape: sessionId ${parsed.state.sessionId} does not match file session ${sessionId}`, now);
    }
    return { status: "ready", path, state: parsed.state };
  };
  const writeState = async (state) => {
    const path = sessionPath(state.sessionId);
    try {
      await writeJsonAtomically(path, state);
      return state;
    } catch (error) {
      throw new Error(`Unable to write session state at ${path}: ${errorMessage(error)}`);
    }
  };
  const create = async (input) => {
    const existing = await read(input.sessionId);
    if (existing.status === "ready")
      return existing.state;
    const timestamp = now();
    return writeState(createInitialSessionState(input, timestamp));
  };
  const save = async (state) => {
    return writeState({ ...state, updatedAt: now() });
  };
  const appendExperiment = async (sessionId, input) => {
    const existing = await read(sessionId);
    if (existing.status !== "ready") {
      throw new Error(`Cannot append experiment for ${sessionId}: session state is ${existing.status}`);
    }
    const timestamp = now();
    const experiment = createExperiment(input, timestamp);
    const previousExperiment = existing.state.experiments.find((candidate) => candidate.id === input.id);
    const experiments = upsertById(existing.state.experiments, previousExperiment ? { ...experiment, createdAt: previousExperiment.createdAt } : experiment);
    const metrics = input.metric ? upsertBySourceExperiment(existing.state.metrics, { ...input.metric, sourceExperimentId: input.id }) : existing.state.metrics.filter((metric) => metric.sourceExperimentId !== input.id);
    return writeState({
      ...existing.state,
      updatedAt: timestamp,
      experiments,
      metrics
    });
  };
  return {
    baseDir,
    sessionPath,
    read,
    create,
    save,
    appendExperiment
  };
}
function assertSafeSessionId(sessionId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(sessionId)) {
    throw new Error(`Unsafe session id: ${sessionId}`);
  }
  return sessionId;
}
async function quarantineCorruptFile(path, reason, now) {
  const corruptPath = await nextCorruptPath(path, now());
  await rename2(path, corruptPath);
  return {
    status: "recovered",
    path,
    corruptPath,
    reason: `${reason}. Moved unreadable state to ${corruptPath}.`
  };
}
async function nextCorruptPath(path, timestamp) {
  const safeTimestamp = timestamp.replace(/[^0-9A-Za-z._-]/g, "") || `${Date.now()}`;
  let candidate = `${path}.corrupt.${safeTimestamp}`;
  let suffix = 1;
  while (await fileExists(candidate)) {
    candidate = `${path}.corrupt.${safeTimestamp}.${suffix}`;
    suffix += 1;
  }
  return candidate;
}
async function fileExists(path) {
  try {
    await readFile2(path);
    return true;
  } catch (error) {
    if (isFileNotFound2(error))
      return false;
    throw error;
  }
}
async function writeJsonAtomically(path, state) {
  await mkdir3(dirname2(path), { recursive: true });
  const content = `${JSON.stringify(state, null, 2)}
`;
  const tempPath = join3(dirname2(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}-${atomicWriteCounter++}`);
  let closed = false;
  const handle = await open(tempPath, "w", 384);
  try {
    await handle.writeFile(content, "utf-8");
    await handle.sync();
    await handle.close();
    closed = true;
    await rename2(tempPath, path);
    fsyncDirectory(dirname2(path));
  } catch (error) {
    if (!closed) {
      try {
        await handle.close();
      } catch {}
    }
    await rm2(tempPath, { force: true });
    throw error;
  }
}
function fsyncDirectory(path) {
  if (process.platform === "win32")
    return;
  let descriptor;
  try {
    descriptor = openSync(path, "r");
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined)
      closeSync(descriptor);
  }
}
function upsertById(items, item) {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1)
    return [...items, item];
  return [...items.slice(0, index), item, ...items.slice(index + 1)];
}
function upsertBySourceExperiment(items, item) {
  const index = items.findIndex((candidate) => candidate.sourceExperimentId === item.sourceExperimentId);
  if (index === -1)
    return [...items, item];
  return [...items.slice(0, index), item, ...items.slice(index + 1)];
}
function isFileNotFound2(error) {
  return isErrorWithCode(error) && error.code === "ENOENT";
}
function isErrorWithCode(error) {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/cli.ts
var COMMANDS = [
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
  "finalize-preview"
];
var commandHandlers = {
  "install-agent": installAgentCommand,
  ...intakeHandlers,
  ...recommendHandlers,
  ...loopHandlers,
  ...doctorHandlers,
  ...exportHandlers
};
async function main(args, io = processIo()) {
  const parsed = parseCliArgs(args);
  if (parsed.wantsHelp || parsed.command === undefined) {
    io.stdout(helpText());
    return 0;
  }
  if (!isCommandName(parsed.command)) {
    io.stderr(`Unknown command: ${parsed.command}
`);
    return 1;
  }
  try {
    io.stdout(`${JSON.stringify(await commandHandlers[parsed.command](commandContext(parsed.command, parsed.options)), null, 2)}
`);
    return 0;
  } catch (error) {
    io.stderr(`${errorMessage2(error)}
`);
    return 1;
  }
}
function optionString(options, key) {
  const value = options[key];
  if (typeof value === "string")
    return value;
  return;
}
function optionBoolean(options, key) {
  const value = options[key];
  if (typeof value === "boolean")
    return value;
  if (typeof value !== "string")
    return false;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}
function stateContract(context, family, extra = {}) {
  return {
    ok: true,
    command: context.command,
    family,
    sessionId: context.sessionId,
    stateDir: context.store.baseDir,
    statePath: context.store.sessionPath(context.sessionId),
    ...extra
  };
}
function commandContext(command, options) {
  const store = createSessionStore({ baseDir: optionString(options, "state-dir") });
  return {
    args: options,
    command,
    sessionId: optionString(options, "session-id") ?? "default",
    store
  };
}
function parseCliArgs(args) {
  const options = { _: [] };
  let command;
  let wantsHelp = false;
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      options._.push(...args.slice(index + 1));
      break;
    }
    if (arg === "--help" || arg === "-h") {
      wantsHelp = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const equalsAt = arg.indexOf("=");
      const key = equalsAt > 2 ? arg.slice(2, equalsAt) : arg.slice(2);
      if (equalsAt > 2) {
        setOption(options, key, arg.slice(equalsAt + 1));
        continue;
      }
      const next = args[index + 1];
      if (next === undefined || next.startsWith("--")) {
        setOption(options, key, true);
        continue;
      }
      setOption(options, key, next);
      index += 1;
      continue;
    }
    if (command === undefined) {
      command = arg;
      continue;
    }
    options._.push(arg);
  }
  return { command, options, wantsHelp };
}
function setOption(options, key, value) {
  options[key] = value;
  const camelKey = key.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  if (camelKey !== key)
    options[camelKey] = value;
}
function helpText() {
  return `opencode-autoresearch

Usage:
  bun dist/cli.js <command> [options]

Commands:
  install-agent       Copy packaged agent/autoresearch.md into an opencode config directory.
  prompt-plan         Record the goal and constraints in plugin-owned session state.
  setup-plan          Record setup checklist items for the session.
  onboarding-packet   Print the current session summary.
  recommend-next      Return one safe next experiment recommendation.
  next-experiment     Create or return a pending experiment entry.
  log-experiment      Record an experiment result, metric, and status.
  doctor-session      Report missing setup, stale experiments, and recovery issues.
  checks-inspect      Record supplied check output summary.
  benchmark-lint      Validate benchmark metric contract fields.
  export-dashboard    Write offline JSON and Markdown dashboard snapshots.
  finalize-preview    Preview finalization counts without mutating source files.

Options:
  --state-dir <dir>    Use a plugin-owned state directory instead of the default .opencode-autoresearch path.
  --session-id <id>    Select a safe session id for state path resolution. Defaults to "default".
  --config-dir <dir>   Required for install-agent; destination root for agent/autoresearch.md.
  --force              Allow install-agent to overwrite an existing agent file.
  --help               Show this help.

export-dashboard writes a static snapshot only; it does not start a browser UI or live server.
`;
}
function isCommandName(value) {
  return COMMANDS.includes(value);
}
function processIo() {
  return {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text)
  };
}
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
export {
  stateContract,
  optionString,
  optionBoolean,
  main,
  COMMANDS
};
