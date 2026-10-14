import { RawModelItem, OpenCodeModelConfig, NineRouterOptions } from "./types";
import { getCachePath, readCache, readStaleCache, writeCache } from "./cache";
import { enrichModel } from "./enricher";

export function normalizeModelsUrl(baseURL?: string): string {
  const base = (baseURL || "http://127.0.0.1:20128/v1").trim().replace(/\/+$/, "");
  if (base.endsWith("/models")) {
    return base;
  }
  if (base.endsWith("/v1")) {
    return `${base}/models`;
  }
  return `${base}/v1/models`;
}

export async function discoverModels(options: NineRouterOptions = {}): Promise<Record<string, OpenCodeModelConfig>> {
  const modelsUrl = normalizeModelsUrl(options.baseURL);
  const ttl = options.cacheTTL ?? 3 * 60 * 60 * 1000; // 3 hours
  const apiKey = (options.apiKey || process.env.NINEROUTER_API_KEY || "").trim();
  const cachePath = getCachePath(options.baseURL || "http://127.0.0.1:20128/v1", options.cacheDir, apiKey);

  if (options.cache !== false) {
    const cached = readCache(cachePath, ttl);
    if (cached && Object.keys(cached).length > 0) {
      return cached;
    }
  }

  const controller = new AbortController();
  const timeoutMs = options.discoveryTimeout ?? 10000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = apiKey.toLowerCase().startsWith("bearer ")
        ? apiKey
        : `Bearer ${apiKey}`;
    }

    const res = await fetch(modelsUrl, {
      headers,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const payload = (await res.json()) as { data?: unknown[] } | unknown[];
    const rawList = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { data?: unknown[] })?.data)
        ? (payload as { data: unknown[] }).data
        : [];

    const models: Record<string, OpenCodeModelConfig> = {};
    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;
      const m = item as RawModelItem;
      if (!m.id || typeof m.id !== "string") continue;

      if (options.excludePrefixes?.some((p) => m.id.startsWith(p))) {
        continue;
      }
      models[m.id] = enrichModel(m);
    }

    if (options.cache !== false && Object.keys(models).length > 0) {
      writeCache(cachePath, models);
    }

    return models;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (options.staleFallback !== false) {
      const stale = readStaleCache(cachePath);
      if (stale && Object.keys(stale).length > 0) {
        console.warn(`[opencode-9router] discovery from ${modelsUrl} failed (${reason}); using stale cache`);
        return stale;
      }
    }
    console.warn(`[opencode-9router] discovery from ${modelsUrl} failed (${reason}); returning empty model list`);
    return {};
  } finally {
    clearTimeout(timer);
  }
}
