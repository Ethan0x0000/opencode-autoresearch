import { type CommandContext } from "../cli";
export declare const exportHandlers: {
    "export-dashboard": (context: CommandContext) => Promise<{
        ok: boolean;
        command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
        family: string;
        sessionId: string;
        stateDir: string;
        statePath: string;
    }>;
    "finalize-preview": (context: CommandContext) => Promise<{
        ok: boolean;
        command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
        family: string;
        sessionId: string;
        stateDir: string;
        statePath: string;
    }>;
};
