import { describe, it, expect } from "bun:test";
import { execSync } from "child_process";
import { nineRouterPlugin } from "../src/index";

const liveAvailable = await fetch("http://127.0.0.1:20128/v1/models", { signal: AbortSignal.timeout(1000) })
  .then((res) => res.ok)
  .catch(() => false);
const opencodeAvailable = Bun.which("opencode") !== null;

describe("E2E Integration", () => {
  it.skipIf(!liveAvailable)("runs full config lifecycle against active local 9Router instance", async () => {
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

  it.skipIf(!opencodeAvailable)("executes OpenCode CLI and verifies 9router models are listed", () => {
    const output = execSync("opencode models 9router", {
      encoding: "utf-8",
      timeout: 10000
    });

    expect(output).toContain("9router/");
    expect(output).toContain("free");
  });
});
