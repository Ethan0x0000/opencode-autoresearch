// @bun
// src/index.ts
var PLUGIN_ID = "opencode-autoresearch";
var pluginModule = {
  id: PLUGIN_ID,
  server: async () => ({})
};
var src_default = pluginModule;
export {
  pluginModule,
  src_default as default,
  PLUGIN_ID
};
