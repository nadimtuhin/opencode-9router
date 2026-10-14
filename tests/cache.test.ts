import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getCachePath, readCache, readStaleCache, writeCache } from "../src/cache";
import { OpenCodeModelConfig } from "../src/types";

describe("cache", () => {
  const testDir = join(tmpdir(), `opencode-9router-cache-test-${Date.now()}`);

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("generates deterministic cache path with custom dir", () => {
    const p1 = getCachePath("http://127.0.0.1:20128/v1", testDir);
    const p2 = getCachePath("http://127.0.0.1:20128/v1", testDir);
    expect(p1).toBe(p2);
    expect(p1.startsWith(testDir)).toBe(true);
    expect(existsSync(testDir)).toBe(true);
  });

  it("has no filesystem side effect and keys on API key without leaking it", () => {
    const missing = join(testDir, "not-created");
    const a = getCachePath("http://h/v1", missing, "secret-a");
    const b = getCachePath("http://h/v1", missing, "secret-b");
    expect(existsSync(missing)).toBe(false);
    expect(a).not.toBe(b);
    expect(a).not.toContain("secret-a");
  });

  it("writes and reads valid cache within TTL", () => {
    const filePath = join(testDir, "test-models.json");
    const sampleModels: Record<string, OpenCodeModelConfig> = {
      "gemini-flash": {
        id: "gemini-flash",
        name: "Gemini Flash",
        limit: { context: 1000000, output: 8192 },
        tools: true
      }
    };

    writeCache(filePath, sampleModels);
    expect(existsSync(filePath)).toBe(true);

    const loaded = readCache(filePath, 60000);
    expect(loaded).not.toBeNull();
    expect(loaded!["gemini-flash"].id).toBe("gemini-flash");
  });

  it("returns null when TTL expires for readCache but stale cache still returns data", async () => {
    const filePath = join(testDir, "expired-models.json");
    const sampleModels: Record<string, OpenCodeModelConfig> = {
      "test-model": {
        id: "test-model",
        name: "Test",
        limit: { context: 32000, output: 4096 }
      }
    };

    writeCache(filePath, sampleModels);
    // Artificially age the timestamp in file
    const oldTimestamp = Date.now() - 5000;
    writeFileSync(filePath, JSON.stringify({ timestamp: oldTimestamp, models: sampleModels }));

    // readCache with 1000ms TTL should fail (expired)
    expect(readCache(filePath, 1000)).toBeNull();

    // readStaleCache should still return the data
    const stale = readStaleCache(filePath);
    expect(stale).not.toBeNull();
    expect(stale!["test-model"].id).toBe("test-model");
  });

  it("handles non-existent files gracefully", () => {
    const missing = join(testDir, "does-not-exist.json");
    expect(readCache(missing, 10000)).toBeNull();
    expect(readStaleCache(missing)).toBeNull();
  });

  it("handles corrupt JSON files gracefully without throwing", () => {
    const corruptPath = join(testDir, "corrupt.json");
    writeFileSync(corruptPath, "{ corrupt json ... invalid");

    expect(readCache(corruptPath, 10000)).toBeNull();
    expect(readStaleCache(corruptPath)).toBeNull();
  });
});
