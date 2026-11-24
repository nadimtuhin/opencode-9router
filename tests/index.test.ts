import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync, mkdirSync } from "fs";
import { nineRouterPlugin, NineRouterPlugin } from "../src/index";

describe("plugin lifecycle", () => {
  const testCacheDir = join(tmpdir(), `opencode-9router-plugin-test-${Date.now()}`);

  beforeEach(() => {
    rmSync(testCacheDir, { recursive: true, force: true });
    mkdirSync(testCacheDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testCacheDir, { recursive: true, force: true });
  });

  it("exports both camelCase, PascalCase and default object plugin hooks", () => {
    expect(typeof nineRouterPlugin).toBe("function");
    expect(typeof NineRouterPlugin).toBe("function");
    const pluginInstance = nineRouterPlugin();
    expect(typeof pluginInstance.config).toBe("function");
  });

  it("auto-registers default 9router provider when none exists", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          data: [{ id: "auto-discovered-model" }]
        });
      }
    });

    try {
      const plugin = nineRouterPlugin();
      const config: any = { provider: {} };

      // Override default baseURL for test by pre-seeding options with cacheDir
      config.provider = {
        "9router": {
          options: {
            baseURL: `http://127.0.0.1:${server.port}/v1`,
            cacheDir: testCacheDir,
            cache: false
          }
        }
      };

      await plugin.config(config);

      expect(config.provider["9router"]).toBeDefined();
      expect(config.provider["9router"].models["auto-discovered-model"]).toBeDefined();
    } finally {
      server.stop();
    }
  });

  it("supports multi-instance gateway prefixes (e.g. 9router, 9router-work)", async () => {
    const s1 = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ data: [{ id: "model-from-s1" }] });
      }
    });
    const s2 = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ data: [{ id: "model-from-s2" }] });
      }
    });

    try {
      const plugin = nineRouterPlugin();
      const config: any = {
        provider: {
          "9router": {
            options: {
              baseURL: `http://127.0.0.1:${s1.port}/v1`,
              cacheDir: testCacheDir,
              cache: false
            }
          },
          "9router-work": {
            options: {
              baseURL: `http://127.0.0.1:${s2.port}/v1`,
              cacheDir: testCacheDir,
              cache: false
            }
          },
          "other-provider": {
            options: { baseURL: "http://other" }
          }
        }
      };

      await plugin.config(config);

      expect(config.provider["9router"].models["model-from-s1"]).toBeDefined();
      expect(config.provider["9router-work"].models["model-from-s2"]).toBeDefined();
      expect(config.provider["other-provider"].models).toBeUndefined();
    } finally {
      s1.stop();
      s2.stop();
    }
  });

  it("preserves pre-existing manually defined models in provider config", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ data: [{ id: "discovered-model" }] });
      }
    });

    try {
      const plugin = nineRouterPlugin();
      const config: any = {
        provider: {
          "9router": {
            options: {
              baseURL: `http://127.0.0.1:${server.port}/v1`,
              cacheDir: testCacheDir,
              cache: false
            },
            models: {
              "my-custom-pinned-model": {
                name: "Custom Pinned",
                limit: { context: 8192, output: 2048 }
              }
            }
          }
        }
      };

      await plugin.config(config);

      expect(config.provider["9router"].models["my-custom-pinned-model"]).toBeDefined();
      expect(config.provider["9router"].models["discovered-model"]).toBeDefined();
    } finally {
      server.stop();
    }
  });

  it("lets user-configured models win over discovered ones with the same id", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ data: [{ id: "m1", name: "Discovered" }] });
      }
    });

    try {
      const config: any = {
        provider: {
          "9router": {
            options: {
              baseURL: `http://127.0.0.1:${server.port}/v1`,
              cacheDir: testCacheDir,
              cache: false
            },
            models: { m1: { id: "m1", name: "Mine" } }
          }
        }
      };

      await nineRouterPlugin().config(config);

      expect(config.provider["9router"].models.m1.name).toBe("Mine");
    } finally {
      server.stop();
    }
  });

  it("wires NINEROUTER_API_KEY into the provider via env so chat requests are authenticated", async () => {
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ data: [{ id: "m" }] }) });
    const prev = process.env.NINEROUTER_API_KEY;
    process.env.NINEROUTER_API_KEY = "env-secret-value";
    try {
      const config: any = {
        provider: {
          "9router": { options: { baseURL: `http://127.0.0.1:${server.port}/v1`, cache: false } },
          "9router-custom": {
            env: ["MY_ROUTER_KEY"],
            options: { baseURL: `http://127.0.0.1:${server.port}/v1`, cache: false }
          }
        }
      };
      await nineRouterPlugin().config(config);
      expect(config.provider["9router"].env).toEqual(["NINEROUTER_API_KEY"]);
      // A user-declared env is left untouched: opencode only forwards an env key
      // when `env` has exactly one entry, so appending would drop the user's key.
      expect(config.provider["9router-custom"].env).toEqual(["MY_ROUTER_KEY"]);
      // The secret itself must not be copied into the config object.
      expect(JSON.stringify(config)).not.toContain("env-secret-value");
    } finally {
      if (prev === undefined) delete process.env.NINEROUTER_API_KEY;
      else process.env.NINEROUTER_API_KEY = prev;
      server.stop(true);
    }
  });

  it("never changes a user-declared env list (opencode needs exactly one entry to pass the key)", async () => {
    const origWarn = console.warn;
    console.warn = () => {};
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error("offline"); }) as any;
    const config: any = {
      provider: {
        "9router-a": { env: ["A_KEY"], options: { cache: false } },
        "9router-b": { env: ["A_KEY", "B_KEY"], options: { cache: false } }
      }
    };
    try {
      await nineRouterPlugin().config(config);
    } finally {
      globalThis.fetch = origFetch;
      console.warn = origWarn;
    }
    expect(config.provider["9router-a"].env).toEqual(["A_KEY"]);
    expect(config.provider["9router-b"].env).toEqual(["A_KEY", "B_KEY"]);
  });

  it("sets env on the auto-registered default provider", async () => {
    const config: any = { provider: {} };
    // Point discovery at a closed port so the test is fast and offline.
    const origWarn = console.warn;
    console.warn = () => {};
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error("offline"); }) as any;
    try {
      await nineRouterPlugin().config(config);
    } finally {
      globalThis.fetch = origFetch;
      console.warn = origWarn;
    }
    expect(config.provider["9router"].env).toEqual(["NINEROUTER_API_KEY"]);
  });
});
