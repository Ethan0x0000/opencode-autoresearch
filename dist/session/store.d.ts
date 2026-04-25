import { type NewSessionExperimentInput, type NewSessionStateInput, type SessionState } from "./schema";
export declare const DEFAULT_SESSION_BASE_DIR: string;
export type SessionStoreOptions = {
    baseDir?: string;
    now?: () => string;
};
export type SessionReadResult = {
    status: "missing";
    path: string;
} | {
    status: "ready";
    path: string;
    state: SessionState;
} | {
    status: "recovered";
    path: string;
    corruptPath: string;
    reason: string;
};
export type SessionStore = {
    baseDir: string;
    sessionPath: (sessionId: string) => string;
    read: (sessionId: string) => Promise<SessionReadResult>;
    create: (input: NewSessionStateInput) => Promise<SessionState>;
    save: (state: SessionState) => Promise<SessionState>;
    appendExperiment: (sessionId: string, input: NewSessionExperimentInput) => Promise<SessionState>;
};
export declare class FutureSessionSchemaVersionError extends Error {
    constructor(version: number, filePath: string);
}
export declare function createSessionStore(options?: SessionStoreOptions): SessionStore;
