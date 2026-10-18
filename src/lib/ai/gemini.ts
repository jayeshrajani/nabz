import "server-only";
import { GoogleGenAI } from "@google/genai";
import { classifyHttpStatus, parseJsonText, ProviderError, withTimeout, type AIProvider } from "./types";

export function createGeminiProvider(apiKey: string, model: string): AIProvider {
  const client = new GoogleGenAI({ apiKey });
  return {
    name: "gemini",
    async generateStructuredResponse(request) {
      return withTimeout(request.timeoutMs, async (signal) => {
        try {
          const response = await client.models.generateContent({
            model,
            contents: request.prompt,
            config: {
              systemInstruction: request.system,
              responseMimeType: "application/json",
              responseJsonSchema: request.jsonSchema,
              temperature: 0.2,
              maxOutputTokens: 1024,
              abortSignal: signal,
            },
          });
          return parseJsonText(response.text);
        } catch (error) {
          if (error instanceof ProviderError || signal.aborted) throw error;
          const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : 0;
          throw new ProviderError("Gemini request failed.", status ? classifyHttpStatus(status) : "unavailable");
        }
      });
    },
  };
}
