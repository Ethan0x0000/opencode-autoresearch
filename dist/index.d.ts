export declare const PLUGIN_ID = "opencode-autoresearch";
export type PluginInput = {
    directory: string;
    worktree: string;
    serverUrl: URL;
};
export type PluginOptions = Record<string, unknown>;
export type PluginHooks = Record<string, never>;
export type PluginModule = {
    id: string;
    server: (input: PluginInput, options?: PluginOptions) => Promise<PluginHooks>;
};
export declare const pluginModule: {
    id: string;
    server: () => Promise<{}>;
};
export default pluginModule;
