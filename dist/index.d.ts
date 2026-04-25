export declare const PLUGIN_ID = "opencode-autoresearch";
export declare const AUTORESEARCH_RUNTIME_NAME: string;
export type PluginInput = {
    directory: string;
    worktree: string;
    serverUrl: URL;
};
export type PluginOptions = Record<string, unknown>;
export type AgentConfig = {
    name?: string;
    mode?: "subagent" | "primary" | "all";
    description?: string;
    prompt?: string;
};
export type OpenCodeConfig = {
    agent?: Record<string, AgentConfig>;
};
export type PluginHooks = {
    config?: (config: OpenCodeConfig) => void | Promise<void>;
};
export type PluginModule = {
    id: string;
    server: (input: PluginInput, options?: PluginOptions) => Promise<PluginHooks>;
};
export declare const pluginModule: {
    id: string;
    server: () => Promise<{
        config(config: OpenCodeConfig): Promise<void>;
    }>;
};
export default pluginModule;
export declare const AUTORESEARCH_AGENT: {
    name: string;
    mode: "primary";
    description: string;
    prompt: string;
};
