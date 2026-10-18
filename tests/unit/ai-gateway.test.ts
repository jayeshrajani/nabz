import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateWithFallback } from "@/lib/ai/gateway";
import { ProviderError, withTimeout, type AIProvider, type ProviderName } from "@/lib/ai/types";

const schema = z.object({ answer: z.string() });
const request = { system: "s", prompt: "p", jsonSchema: {}, timeoutMs: 50 };

function provider(name: ProviderName, impl: () => Promise<unknown>): AIProvider & { calls: number } {
  const p = {
    name,
    calls: 0,
    async generateStructuredResponse() {
      p.calls++;
      return impl();
    },
  };
  return p;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("generateWithFallback", () => {
  it("returns the primary answer without calling the fallback", async () => {
    const gemini = provider("gemini", async () => ({ answer: "ok" }));
    const cerebras = provider("cerebras", async () => ({ answer: "other" }));
    const r = await generateWithFallback([gemini, cerebras], request, schema);
    expect(r).toMatchObject({ ok: true, provider: "gemini", data: { answer: "ok" } });
    expect(cerebras.calls).toBe(0);
  });

  it("falls back to Cerebras on timeout", async () => {
    const gemini = provider("gemini", () => withTimeout(10, (signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))))));
    const cerebras = provider("cerebras", async () => ({ answer: "fallback" }));
    const r = await generateWithFallback([gemini, cerebras], request, schema);
    expect(r).toMatchObject({ ok: true, provider: "cerebras" });
  });

  it("falls back when the primary output fails the schema or grounding check", async () => {
    const gemini = provider("gemini", async () => ({ wrong: true }));
    const cerebras = provider("cerebras", async () => ({ answer: "valid" }));
    expect(await generateWithFallback([gemini, cerebras], request, schema)).toMatchObject({ ok: true, provider: "cerebras" });

    const g2 = provider("gemini", async () => ({ answer: "bad 999" }));
    const c2 = provider("cerebras", async () => ({ answer: "good" }));
    const r = await generateWithFallback([g2, c2], request, schema, (d) => (d.answer.includes("999") ? "ungrounded" : null));
    expect(r).toMatchObject({ ok: true, provider: "cerebras", data: { answer: "good" } });
  });

  it("reports failure when both providers are unavailable", async () => {
    const gemini = provider("gemini", async () => {
      throw new ProviderError("rate limited", "rate_limit");
    });
    const cerebras = provider("cerebras", async () => {
      throw new ProviderError("down", "unavailable");
    });
    const r = await generateWithFallback([gemini, cerebras], request, schema);
    expect(r).toEqual({ ok: false, attempts: [{ provider: "gemini", category: "rate_limit" }, { provider: "cerebras", category: "unavailable" }] });
  });

  it("does not retry after a non-retryable rejection", async () => {
    const gemini = provider("gemini", async () => {
      throw new ProviderError("bad request", "rejected");
    });
    const cerebras = provider("cerebras", async () => ({ answer: "x" }));
    const r = await generateWithFallback([gemini, cerebras], request, schema);
    expect(r.ok).toBe(false);
    expect(cerebras.calls).toBe(0);
  });
});
