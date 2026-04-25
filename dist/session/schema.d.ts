export declare const SESSION_SCHEMA_VERSION = 1;
export declare const SESSION_STATUSES: readonly ["new", "setup", "running", "complete", "blocked"];
export declare const EXPERIMENT_STATUSES: readonly ["pending", "keep", "discard", "crash", "checks_failed"];
export declare const METRIC_DIRECTIONS: readonly ["higher", "lower"];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];
export type MetricDirection = (typeof METRIC_DIRECTIONS)[number];
export type SessionSetup = {
    checklist: string[];
    notes: string;
};
export type SessionMetric = {
    name: string;
    value: number;
    direction: MetricDirection;
    unit?: string;
    sourceExperimentId?: string;
};
export type SessionExperiment = {
    id: string;
    run: number;
    hypothesis: string;
    status: ExperimentStatus;
    createdAt: string;
    updatedAt: string;
    metric?: SessionMetric;
    evidence?: string;
    rollbackReason?: string;
    nextActionHint?: string;
};
export type SessionRecommendation = {
    id: string;
    summary: string;
    createdAt: string;
    rationale?: string;
};
export type SessionNote = {
    id: string;
    text: string;
    createdAt: string;
};
export type SessionState = {
    schemaVersion: typeof SESSION_SCHEMA_VERSION;
    sessionId: string;
    goal: string;
    setup: SessionSetup;
    status: SessionStatus;
    createdAt: string;
    updatedAt: string;
    experiments: SessionExperiment[];
    metrics: SessionMetric[];
    recommendations: SessionRecommendation[];
    notes: SessionNote[];
};
export type NewSessionStateInput = {
    sessionId: string;
    goal?: string;
    setup?: Partial<SessionSetup>;
    status?: SessionStatus;
};
export type NewSessionExperimentInput = {
    id: string;
    run: number;
    hypothesis: string;
    status: ExperimentStatus;
    metric?: SessionMetric;
    evidence?: string;
    rollbackReason?: string;
    nextActionHint?: string;
};
export type SessionParseResult = {
    ok: true;
    state: SessionState;
} | {
    ok: false;
    kind: "corrupt";
    reason: string;
} | {
    ok: false;
    kind: "future-version";
    version: number;
    reason: string;
};
export declare function createInitialSessionState(input: NewSessionStateInput, timestamp: string): SessionState;
export declare function parseSessionState(value: unknown): SessionParseResult;
export declare function createExperiment(input: NewSessionExperimentInput, timestamp: string): SessionExperiment;
