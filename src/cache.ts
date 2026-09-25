import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import { OpenCodeModelConfig } from "./types";

const DEFAULT_CACHE_DIR = join(homedir(), ".cache", "opencode-9router");

export function getCachePath(baseURL: string, customCacheDir?: string): string {
  const dir = customCacheDir || DEFAULT_CACHE_DIR;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const hash = createHash("sha256").update(baseURL).digest("hex").slice(0, 16);
  return join(dir, `models-${hash}.json`);
}

export function readCache(filePath: string, ttl: number): Record<string, OpenCodeModelConfig> | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    if (typeof raw?.timestamp === "number" && Date.now() - raw.timestamp < ttl) {
      return (raw.models as Record<string, OpenCodeModelConfig>) || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function readStaleCache(filePath: string): Record<string, OpenCodeModelConfig> | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    return (raw.models as Record<string, OpenCodeModelConfig>) || null;
  } catch {
    return null;
  }
}

export function writeCache(filePath: string, models: Record<string, OpenCodeModelConfig>): void {
  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(tmpPath, JSON.stringify({ timestamp: Date.now(), models }, null, 2));
    renameSync(tmpPath, filePath);
  } catch {
    // Non-fatal if cache write fails; cleanup tmp if exists
    try {
      if (existsSync(tmpPath)) {
        unlinkSync(tmpPath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}
