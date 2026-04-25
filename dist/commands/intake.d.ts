import { type CommandContext } from "../cli";
export declare const intakeHandlers: {
    "prompt-plan": (context: CommandContext) => Promise<{
        ok: boolean;
        command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "install-agent" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
        family: string;
        sessionId: string;
        stateDir: string;
        statePath: string;
    }>;
    "setup-plan": (context: CommandContext) => Promise<{
        ok: boolean;
        command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "install-agent" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
        family: string;
        sessionId: string;
        stateDir: string;
        statePath: string;
    }>;
    "onboarding-packet": (context: CommandContext) => Promise<{
        ok: boolean;
        command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "install-agent" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
        family: string;
        sessionId: string;
        stateDir: string;
        statePath: string;
    }>;
};
