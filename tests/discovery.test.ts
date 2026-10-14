import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync, mkdirSync } from "fs";
import { discoverModels, normalizeModelsUrl } from "../src/discovery";

describe("discovery", () => {
  const testCacheDir = join(tmpdir(), `opencode-9router-disc-test-${Date.now()}`);

  beforeEach(() => {
    rmSync(testCacheDir, { recursive: true, force: true });
    mkdirSync(testCacheDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testCacheDir, { recursive: true, force: true });
  });

  it("normalizes base URLs correctly to /v1/models", () => {
    expect(normalizeModelsUrl("http://localhost:20128")).toBe("http://localhost:20128/v1/models");
    expect(normalizeModelsUrl("http://localhost:20128/v1")).toBe("http://localhost:20128/v1/models");
    expect(normalizeModelsUrl("http://localhost:20128/v1/")).toBe("http://localhost:20128/v1/models");
    expect(normalizeModelsUrl("http://localhost:20128/v1/models")).toBe("http://localhost:20128/v1/models");
    expect(normalizeModelsUrl()).toBe("http://127.0.0.1:20128/v1/models");
  });

  it("fetches, enriches, and filters models via HTTP server", async () => {
    let receivedAuth = "";
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        receivedAuth = req.headers.get("authorization") || "";
        return Response.json({
          object: "list",
          data: [
            { id: "free", owned_by: "combo" },
            { id: "ag/gemini-3-flash", capabilities: { tools: true, contextWindow: 1000000 } },
            { id: "test/ignore-me" }
          ]
        });
      }
    });

    try {
      const models = await discoverModels({
        baseURL: `http://127.0.0.1:${server.port}`,
        apiKey: "test-token-123",
        cache: false,
        excludePrefixes: ["test/"],
        cacheDir: testCacheDir
      });

      expect(receivedAuth).toBe("Bearer test-token-123");
      expect(models["free"]).toBeDefined();
      expect(models["ag/gemini-3-flash"]).toBeDefined();
      expect(models["test/ignore-me"]).toBeUndefined();
    } finally {
      server.stop();
    }
  });

  it("serves from cache on subsequent calls without touching network", async () => {
    let hits = 0;
    const server = Bun.serve({
      port: 0,
      fetch() {
        hits++;
        return Response.json({
          data: [{ id: "cached-model" }]
        });
      }
    });

    try {
      const opts = {
        baseURL: `http://127.0.0.1:${server.port}/v1`,
        cache: true,
        cacheTTL: 60000,
        cacheDir: testCacheDir
      };

      const first = await discoverModels(opts);
      expect(hits).toBe(1);
      expect(first["cached-model"]).toBeDefined();

      const second = await discoverModels(opts);
      expect(hits).toBe(1); // Didn't increment
      expect(second["cached-model"]).toBeDefined();
    } finally {
      server.stop();
    }
  });

  it("falls back to stale cache when server returns 500 or is unreachable", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ data: [{ id: "offline-fallback-model" }] });
      }
    });

    const opts = {
      baseURL: `http://127.0.0.1:${server.port}/v1`,
      cache: true,
      cacheTTL: 50, // very short TTL
      cacheDir: testCacheDir
    };

    // 1. Initial successful fetch
    await discoverModels(opts);

    // 2. Shut down server
    server.stop(true);

    // Wait for TTL to expire
    await Bun.sleep(60);

    // 3. Should return stale cache
    const fallback = await discoverModels({
      ...opts,
      staleFallback: true
    });
    expect(fallback["offline-fallback-model"]).toBeDefined();

    // 4. If staleFallback is false, returns empty object
    const noFallback = await discoverModels({
      ...opts,
      staleFallback: false
    });
    expect(Object.keys(noFallback).length).toBe(0);
  });

  it("logs one warning line when falling back to stale cache or empty list", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ data: [{ id: "warn-model" }] });
      }
    });
    const opts = {
      baseURL: `http://127.0.0.1:${server.port}/v1`,
      cacheTTL: 50,
      cacheDir: testCacheDir
    };
    await discoverModels(opts);
    server.stop(true);
    await Bun.sleep(60);

    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(" "));
    try {
      await discoverModels(opts);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("stale cache");

      warnings.length = 0;
      await discoverModels({ ...opts, staleFallback: false });
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("empty");
    } finally {
      console.warn = original;
    }
  });

  it("does not share cache between different API keys", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const auth = req.headers.get("authorization");
        return Response.json({ data: [{ id: `model-for-${auth}` }] });
      }
    });
    try {
      const opts = { baseURL: `http://127.0.0.1:${server.port}/v1`, cacheDir: testCacheDir };
      const a = await discoverModels({ ...opts, apiKey: "key-a" });
      const b = await discoverModels({ ...opts, apiKey: "key-b" });
      expect(a["model-for-Bearer key-a"]).toBeDefined();
      expect(b["model-for-Bearer key-b"]).toBeDefined();
      expect(b["model-for-Bearer key-a"]).toBeUndefined();
    } finally {
      server.stop(true);
    }
  });
});
