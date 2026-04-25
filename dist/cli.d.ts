#!/usr/bin/env bun
import { type SessionStore } from "./session/store";
export declare const COMMANDS: readonly ["prompt-plan", "setup-plan", "onboarding-packet", "recommend-next", "next-experiment", "log-experiment", "doctor-session", "checks-inspect", "benchmark-lint", "export-dashboard", "finalize-preview"];
export type CommandName = (typeof COMMANDS)[number];
export type CliOptions = Record<string, string | boolean | string[] | undefined> & {
    _: string[];
};
export type CommandContext = {
    args: CliOptions;
    command: CommandName;
    sessionId: string;
    store: SessionStore;
};
export type CommandResult = Record<string, unknown>;
export type CommandHandler = (context: CommandContext) => CommandResult | Promise<CommandResult>;
type CliIo = {
    stdout: (text: string) => void;
    stderr: (text: string) => void;
};
export declare function main(args: string[], io?: CliIo): Promise<1 | 0>;
export declare function optionString(options: CliOptions, key: string): string | undefined;
export declare function optionBoolean(options: CliOptions, key: string): boolean;
export declare function stateContract(context: CommandContext, family: string, extra?: CommandResult): {
    ok: boolean;
    command: "doctor-session" | "checks-inspect" | "benchmark-lint" | "prompt-plan" | "setup-plan" | "onboarding-packet" | "recommend-next" | "next-experiment" | "log-experiment" | "export-dashboard" | "finalize-preview";
    family: string;
    sessionId: string;
    stateDir: string;
    statePath: string;
};
export {};
