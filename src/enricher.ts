import { RawModelItem, OpenCodeModelConfig } from "./types";

export function enrichModel(m: RawModelItem): OpenCodeModelConfig {
  const idLower = (m.id || "").toLowerCase();
  const idTokens = new Set(idLower.split(/[-_/:.]/));
  const hasToken = (token: string) => idTokens.has(token);
  const caps = m.capabilities || {};

  // 1. Context limit: prioritize explicit 9Router capability -> API field -> heuristics -> default 128000
  let context = caps.contextWindow || m.context_length || 0;
  if (!context) {
    if (idLower.includes("gemini")) {
      context = 1000000;
    } else if (idLower.includes("claude")) {
      context = 200000;
    } else if (idLower.includes("gpt-4") || hasToken("o1") || hasToken("o3")) {
      context = 128000;
    } else if (idLower.includes("deepseek") || idLower.includes("qwen")) {
      context = 131072;
    } else if (m.owned_by === "combo" || idLower.includes("combo")) {
      context = 262144;
    } else {
      context = 128000;
    }
  }

  // 2. Output limit: prioritize explicit capability -> completion tokens -> max output tokens -> heuristics -> default 8192
  let output = caps.maxOutput || m.max_completion_tokens || m.max_output_tokens || m.max_tokens || 0;
  if (!output) {
    if (idLower.includes("gemini")) {
      output = 65536;
    } else if (idLower.includes("claude-3-7") || idLower.includes("claude-4") || idLower.includes("sonnet-4")) {
      output = 64000;
    } else if (idLower.includes("gpt-4o")) {
      output = 16384;
    } else if (hasToken("o1") || hasToken("o3")) {
      output = 32768;
    } else if (m.owned_by === "combo" || idLower.includes("combo")) {
      output = 16384;
    } else {
      output = 8192;
    }
  }

  // 3. Tool calling support
  const tools = caps.tools ?? caps.tool_calling ?? caps.function_calling ?? (
    !idLower.includes("base") && !idLower.includes("instruct-base")
  );

  // 4. Vision / attachment support
  const vision = caps.vision ?? caps.attachment ?? (
    idLower.includes("vision") ||
    idLower.includes("4o") ||
    idLower.includes("claude-3") ||
    idLower.includes("claude-4") ||
    idLower.includes("gemini") ||
    hasToken("vl") ||
    m.owned_by === "combo"
  );

  // 5. Reasoning support
  const reasoning = caps.reasoning ?? caps.thinking ?? (
    hasToken("o1") ||
    hasToken("o3") ||
    hasToken("r1") ||
    idLower.includes("reason") ||
    idLower.includes("thinking") ||
    idLower.includes("deepseek-r1") ||
    idLower.includes("qwq")
  );

  return {
    id: m.id,
    name: m.name || m.id,
    limit: {
      context: Math.max(context, 4096),
      output: Math.max(output, 1024)
    },
    tools,
    tool_call: tools,
    vision,
    attachment: vision,
    reasoning,
    temperature: caps.temperature ?? !reasoning
  };
}
