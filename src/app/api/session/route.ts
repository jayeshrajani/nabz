import { apiHandler } from "@/lib/api/handler";
import { authenticate } from "@/lib/auth/server";
import { getRepository } from "@/lib/data";

/** Idempotently provisions the caller's isolated synthetic dataset from the immutable seed template. */
export const POST = apiHandler("session.bootstrap", async ({ request }) => {
  const principal = await authenticate(request);
  const { created } = await getRepository().ensureSession(principal.sessionId);
  return { role: principal.role, created };
});
