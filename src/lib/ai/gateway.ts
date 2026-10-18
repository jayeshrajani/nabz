import type { z } from "zod";
import { describeError, logger } from "@/lib/observability/logger";
import { ProviderError, type AIProvider, type ProviderName, type StructuredRequest } from "./types";

export type GatewayResult<T> =
  | { ok: true; data: T; provider: ProviderName; latencyMs: number }
  | { ok: false; attempts: { provider: ProviderName; category: string }[] };

/**
 * Tries providers in order, at most once each. Moves to the next provider on timeouts, rate limits,
 * service errors, or output that fails schema/grounding validation. Stops at the first valid answer.
 */
export async function generateWithFallback<T>(
  providers: readonly AIProvider[],
  request: StructuredRequest,
  schema: z.ZodType<T>,
  validate: (data: T) => string | null = () => null,
): Promise<GatewayResult<T>> {
  const attempts: { provider: ProviderName; category: string }[] = [];

  for (const provider of providers) {
    const started = performance.now();
    try {
      const raw = await provider.generateStructuredResponse(request);
      const parsed = schema.safeParse(raw);
      if (!parsed.success) throw new ProviderError("Response did not match schema.", "invalid_output");
      const problem = validate(parsed.data);
      if (problem) throw new ProviderError(problem, "invalid_output");

      const latencyMs = Math.round(performance.now() - started);
      logger.info("ai provider succeeded", { provider: provider.name, latencyMs });
      return { ok: true, data: parsed.data, provider: provider.name, latencyMs };
    } catch (error) {
      const category = error instanceof ProviderError ? error.category : "unavailable";
      attempts.push({ provider: provider.name, category });
      logger.warn("ai provider failed", {
        provider: provider.name,
        category,
        latencyMs: Math.round(performance.now() - started),
        ...describeError(error),
      });
      if (error instanceof ProviderError && !error.retryable) break;
    }
  }
  return { ok: false, attempts };
}
