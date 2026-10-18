import "server-only";
import { createCerebrasProvider } from "./cerebras";
import { createGeminiProvider } from "./gemini";
import type { AIProvider } from "./types";

const DEFAULT_TIMEOUT_MS = 12_000;

/** Builds the provider chain from env. A provider needs both a key and an explicit model id; nothing is hardcoded. */
export function configuredProviders(env: NodeJS.ProcessEnv = process.env): AIProvider[] {
  const gemini = env.GEMINI_API_KEY && env.GEMINI_MODEL ? createGeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL) : null;
  const cerebras = env.CEREBRAS_API_KEY && env.CEREBRAS_MODEL ? createCerebrasProvider(env.CEREBRAS_API_KEY, env.CEREBRAS_MODEL) : null;
  const ordered = env.AI_PRIMARY_PROVIDER === "cerebras" ? [cerebras, gemini] : [gemini, cerebras];
  return ordered.filter((p): p is AIProvider => p !== null);
}

export function requestTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.AI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1000 && value <= 60_000 ? value : DEFAULT_TIMEOUT_MS;
}
