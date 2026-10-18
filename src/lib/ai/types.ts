export type ProviderName = "gemini" | "cerebras";

export interface StructuredRequest {
  system: string;
  prompt: string;
  /** JSON Schema describing the expected object; providers that cannot enforce it still receive it as guidance. */
  jsonSchema: Record<string, unknown>;
  timeoutMs: number;
}

export interface AIProvider {
  name: ProviderName;
  /** Returns parsed JSON. Validation against the shared Zod schema happens in the gateway. */
  generateStructuredResponse(request: StructuredRequest): Promise<unknown>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly category: "timeout" | "rate_limit" | "unavailable" | "invalid_output" | "rejected",
  ) {
    super(message);
    this.name = "ProviderError";
  }

  get retryable(): boolean {
    return this.category !== "rejected";
  }
}

export function classifyHttpStatus(status: number): ProviderError["category"] {
  if (status === 429) return "rate_limit";
  if (status === 408 || status >= 500) return "unavailable";
  return "rejected";
}

/** Runs `fn` with an AbortSignal that fires after `ms`, mapping aborts to a timeout ProviderError. */
export async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new ProviderError("Provider timed out.", "timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function parseJsonText(text: string | undefined | null): unknown {
  if (!text) throw new ProviderError("Empty response.", "invalid_output");
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("Response was not valid JSON.", "invalid_output");
  }
}
