import { type CommandContext } from "../cli";
export declare const doctorHandlers: {
    "doctor-session": (context: CommandContext) => Promise<{
        ok: boolean;
        command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
        family: string;
        sessionId: string;
        stateDir: string;
        statePath: string;
    }>;
    "checks-inspect": (context: CommandContext) => Promise<{
        ok: boolean;
        command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
        family: string;
        sessionId: string;
        stateDir: string;
        statePath: string;
    }>;
    "benchmark-lint": (context: CommandContext) => Promise<{
        ok: boolean;
        command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
        family: string;
        sessionId: string;
        stateDir: string;
        statePath: string;
    }>;
};
