export type DefaultExportModule = {
    default?: unknown;
};
export type ValidPlugin = {
    id: string;
    server: (input: unknown, options?: unknown) => unknown;
};
export type LoadRequest = {
    module: unknown;
    enabled?: boolean;
};
export type LoadResult = {
    status: "loaded";
    id: string;
    active: true;
} | {
    status: "disabled";
    id: string;
    active: false;
} | {
    status: "duplicate";
    id: string;
    active: false;
} | {
    status: "invalid";
    error: string;
    active: false;
};
export declare function defaultExport(module: unknown): unknown | undefined;
export declare function validatePlugin(module: unknown, expectedId?: string): {
    ok: true;
    plugin: ValidPlugin;
} | {
    ok: false;
    error: string;
};
export declare function simulatePluginLoader(requests: LoadRequest[]): Promise<LoadResult[]>;
