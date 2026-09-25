import { describe, it, expect } from "bun:test";
import { execSync } from "child_process";
import { nineRouterPlugin } from "../src/index";

describe("E2E Integration", () => {
  it("runs full config lifecycle against active local 9Router instance", async () => {
    // Check if local 9Router is active
    let liveAvailable = false;
    try {
      const res = await fetch("http://127.0.0.1:20128/v1/models", { signal: AbortSignal.timeout(1000) });
      liveAvailable = res.ok;
    } catch {
      liveAvailable = false;
    }

    if (!liveAvailable) {
      console.warn("Skipping live 9Router test: daemon not reachable at http://127.0.0.1:20128");
      return;
    }

    const plugin = nineRouterPlugin();
    const config: any = {
      provider: {
        "9router": {
          npm: "@ai-sdk/openai-compatible",
          name: "9Router Test",
          options: {
            baseURL: "http://127.0.0.1:20128/v1"
          }
        }
      }
    };

    await plugin.config(config);

    const models = config.provider["9router"].models;
    expect(models).toBeDefined();
    expect(Object.keys(models).length).toBeGreaterThan(10);

    // Verify combo models
    expect(models["free"]).toBeDefined();
    expect(models["free"].id).toBe("free");
    expect(models["free"].limit.context).toBeGreaterThanOrEqual(128000);
    expect(models["free"].tools).toBe(true);

    // Verify Antigravity / Gemini models if present
    const geminiKey = Object.keys(models).find((k) => k.includes("gemini"));
    if (geminiKey) {
      expect(models[geminiKey].limit.context).toBeGreaterThanOrEqual(128000);
    }
  });

  it("executes OpenCode CLI and verifies 9router models are listed", () => {
    try {
      const output = execSync("opencode models 9router", {
        encoding: "utf-8",
        timeout: 10000
      });

      expect(output).toContain("9router/");
      expect(output).toContain("free");
    } catch (e: any) {
      // If opencode CLI is not configured in environment, skip gracefully
      if (e.message.includes("not found")) {
        console.warn("opencode CLI not found in PATH, skipping CLI execution check");
        return;
      }
      throw e;
    }
  });
});
