import { apiHandler } from "@/lib/api/handler";
import { authorize } from "@/lib/api/guard";
import { readJson } from "@/lib/api/request";
import { configuredProviders, requestTimeoutMs } from "@/lib/ai/config";
import { answerQuestion } from "@/lib/assistant/answer";
import { AssistantRequestSchema } from "@/lib/assistant/grounding";
import { loadDistrictView } from "@/lib/data/views";

/** Read-only district copilot. Grounded in the caller's own session; cannot mutate anything. */
export const POST = apiHandler("assistant.ask", async ({ request }) => {
  const principal = await authorize(request, "district:read", "assistant");

  const { question, locale } = await readJson(request, AssistantRequestSchema, 2048);
  const view = await loadDistrictView(principal.sessionId);
  return answerQuestion(view, question, locale, configuredProviders(), requestTimeoutMs());
});
