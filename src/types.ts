export interface NineRouterOptions {
  baseURL?: string;
  apiKey?: string;
  cache?: boolean;
  cacheTTL?: number; // Default: 3 hours in ms
  discoveryTimeout?: number; // Default: 10 seconds in ms
  staleFallback?: boolean; // Default: true
  excludePrefixes?: string[]; // e.g. ["test/"]
  cacheDir?: string; // Optional custom cache directory
}

export interface RawModelCapabilities {
  vision?: boolean;
  tools?: boolean;
  tool_calling?: boolean;
  function_calling?: boolean;
  reasoning?: boolean;
  thinking?: boolean;
  contextWindow?: number;
  maxOutput?: number;
  temperature?: boolean;
  attachment?: boolean;
  pdf?: boolean;
  [key: string]: unknown;
}

export interface RawModelItem {
  id: string;
  name?: string;
  object?: string;
  owned_by?: string;
  context_length?: number;
  max_tokens?: number;
  max_output_tokens?: number;
  max_completion_tokens?: number;
  pricing?: Record<string, unknown>;
  capabilities?: RawModelCapabilities;
  [key: string]: unknown;
}

export interface OpenCodeModelConfig {
  id: string;
  name: string;
  limit: {
    context: number;
    output: number;
  };
  tools?: boolean;
  tool_call?: boolean;
  vision?: boolean;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  [key: string]: unknown;
}
