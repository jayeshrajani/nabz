import "server-only";
import { classifyHttpStatus, parseJsonText, ProviderError, withTimeout, type AIProvider } from "./types";

const ENDPOINT = "https://api.cerebras.ai/v1/chat/completions";

/** Cerebras via its OpenAI-compatible chat completions API. JSON mode is requested; the schema is enforced server-side. */
export function createCerebrasProvider(apiKey: string, model: string, fetchImpl: typeof fetch = fetch): AIProvider {
  return {
    name: "cerebras",
    async generateStructuredResponse(request) {
      return withTimeout(request.timeoutMs, async (signal) => {
        const response = await fetchImpl(ENDPOINT, {
          method: "POST",
          signal,
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_completion_tokens: 1024,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `${request.system}\n\nReturn only a JSON object matching this JSON Schema:\n${JSON.stringify(request.jsonSchema)}`,
              },
              { role: "user", content: request.prompt },
            ],
          }),
        });
        if (!response.ok) throw new ProviderError(`Cerebras returned ${response.status}.`, classifyHttpStatus(response.status));
        const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        return parseJsonText(body.choices?.[0]?.message?.content);
      });
    },
  };
}
