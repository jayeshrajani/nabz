import { apiHandler } from "@/lib/api/handler";
import { createRateLimiter } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { configuredProviders, requestTimeoutMs } from "@/lib/ai/config";
import { answerQuestion } from "@/lib/assistant/answer";
import { AssistantRequestSchema } from "@/lib/assistant/grounding";
import { can } from "@/lib/auth/roles";
import { authenticate } from "@/lib/auth/server";
import { loadDistrictView } from "@/lib/data/views";
import { AppError } from "@/lib/errors/app-error";

const allow = createRateLimiter(12, 60_000);

/** Read-only district copilot. Grounded in the caller's own session; cannot mutate anything. */
export const POST = apiHandler("assistant.ask", async ({ request }) => {
  const principal = await authenticate(request);
  if (!can(principal, "district:read")) throw new AppError("FORBIDDEN", "Missing district:read capability.");
  if (!allow(principal.uid)) throw new AppError("RATE_LIMITED", "Too many questions. Try again in a minute.");

  const { question, locale } = await readJson(request, AssistantRequestSchema, 2048);
  const view = await loadDistrictView(principal.sessionId);
  return answerQuestion(view, question, locale, configuredProviders(), requestTimeoutMs());
});
