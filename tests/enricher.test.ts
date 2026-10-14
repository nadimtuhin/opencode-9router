import { describe, it, expect } from "bun:test";
import { enrichModel } from "../src/enricher";
import { RawModelItem } from "../src/types";

describe("enricher", () => {
  it("extracts explicit 9Router capabilities when present", () => {
    const raw: RawModelItem = {
      id: "ag/gemini-3-flash",
      name: "Gemini 3 Flash",
      capabilities: {
        contextWindow: 1048576,
        maxOutput: 65536,
        tools: true,
        vision: true,
        reasoning: false
      }
    };

    const enriched = enrichModel(raw);
    expect(enriched.id).toBe("ag/gemini-3-flash");
    expect(enriched.limit.context).toBe(1048576);
    expect(enriched.limit.output).toBe(65536);
    expect(enriched.tools).toBe(true);
    expect(enriched.tool_call).toBe(true);
    expect(enriched.vision).toBe(true);
    expect(enriched.attachment).toBe(true);
    expect(enriched.reasoning).toBe(false);
  });

  it("applies Gemini heuristic limits and capabilities", () => {
    const raw: RawModelItem = {
      id: "google/gemini-2.5-flash"
    };

    const enriched = enrichModel(raw);
    expect(enriched.limit.context).toBe(1000000);
    expect(enriched.limit.output).toBe(65536);
    expect(enriched.vision).toBe(true);
    expect(enriched.tools).toBe(true);
  });

  it("applies Claude heuristic limits", () => {
    const raw: RawModelItem = {
      id: "anthropic/claude-3-7-sonnet"
    };

    const enriched = enrichModel(raw);
    expect(enriched.limit.context).toBe(200000);
    expect(enriched.limit.output).toBe(64000);
    expect(enriched.vision).toBe(true);
  });

  it("applies DeepSeek R1 reasoning heuristics", () => {
    const raw: RawModelItem = {
      id: "deepseek/deepseek-r1"
    };

    const enriched = enrichModel(raw);
    expect(enriched.reasoning).toBe(true);
    expect(enriched.limit.context).toBe(131072);
  });

  it("applies combo model defaults", () => {
    const raw: RawModelItem = {
      id: "free",
      owned_by: "combo"
    };

    const enriched = enrichModel(raw);
    expect(enriched.limit.context).toBe(262144);
    expect(enriched.limit.output).toBe(16384);
    expect(enriched.vision).toBe(true);
    expect(enriched.tools).toBe(true);
  });

  it("safeguards small context/output with minimum clamps", () => {
    const raw: RawModelItem = {
      id: "tiny-model",
      context_length: 50,
      max_tokens: 20
    };

    const enriched = enrichModel(raw);
    expect(enriched.limit.context).toBe(4096);
    expect(enriched.limit.output).toBe(1024);
  });

  it("matches o1/o3/r1/vl on token boundaries only", () => {
    expect(enrichModel({ id: "foo-pro1-bar" }).reasoning).toBe(false);
    expect(enrichModel({ id: "llama-3-vlad" }).vision).toBe(false);
    expect(enrichModel({ id: "x/gpt-o3x" }).limit.output).toBe(8192);
    expect(enrichModel({ id: "openai/o1-mini" }).reasoning).toBe(true);
    expect(enrichModel({ id: "openai/o3" }).limit.output).toBe(32768);
    expect(enrichModel({ id: "qwen2.5-vl-72b" }).vision).toBe(true);
    expect(enrichModel({ id: "deepseek/r1" }).reasoning).toBe(true);
  });
});
