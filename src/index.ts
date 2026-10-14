import { discoverModels } from "./discovery";

export function nineRouterPlugin(_ctx?: unknown) {
  return {
    config: async (config: any) => {
      if (!config || typeof config !== "object") return;
      config.provider = config.provider || {};

      // Match explicit 9router namespaces or register default
      const providerKeys = Object.keys(config.provider).filter((k) => k.startsWith("9router"));

      if (providerKeys.length === 0) {
        providerKeys.push("9router");
        config.provider["9router"] = {
          npm: "@ai-sdk/openai-compatible",
          name: "9Router (Local)",
          options: {
            baseURL: "http://127.0.0.1:20128/v1"
          }
        };
      }

      await Promise.allSettled(
        providerKeys.map(async (key) => {
          try {
            const prov = config.provider[key];
            if (!prov || typeof prov !== "object") return;

            const opts = { ...(prov.options || {}) };
            if (!opts.apiKey && process.env.NINEROUTER_API_KEY) {
              opts.apiKey = process.env.NINEROUTER_API_KEY;
            }

            const discovered = await discoverModels(opts);
            if (Object.keys(discovered).length > 0) {
              prov.models = {
                ...discovered,
                ...(prov.models || {})
              };
            }
          } catch {
            // Non-fatal: isolate provider failure
          }
        })
      );
    }
  };
}

export const NineRouterPlugin = nineRouterPlugin;

export default Object.assign(nineRouterPlugin, {
  id: "opencode-9router",
  server: nineRouterPlugin
});
