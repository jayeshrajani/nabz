import { apiHandler } from "@/lib/api/handler";
import { authorize } from "@/lib/api/guard";
import { getRepository } from "@/lib/data";

/** Idempotently provisions the caller's isolated synthetic dataset from the immutable seed template. */
export const POST = apiHandler("session.bootstrap", async ({ request }) => {
  const principal = await authorize(request, null, "session");
  const { created } = await getRepository().ensureSession(principal.sessionId);
  return { role: principal.role, created };
});
