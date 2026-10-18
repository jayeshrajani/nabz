import { TransferRequestSchema } from "@/domain/redistribution";
import { apiHandler } from "@/lib/api/handler";
import { idempotencyKey, readJson } from "@/lib/api/request";
import { can } from "@/lib/auth/roles";
import { authenticate } from "@/lib/auth/server";
import { getRepository } from "@/lib/data";
import { loadDistrictView } from "@/lib/data/views";
import { AppError } from "@/lib/errors/app-error";

/** Proposes a transfer. Donor reserve is re-checked server-side; nothing moves until approval and dispatch. */
export const POST = apiHandler("transfer.create", async ({ request }) => {
  const principal = await authenticate(request);
  if (!can(principal, "facility:write")) throw new AppError("FORBIDDEN", "Missing facility:write capability.");
  const key = idempotencyKey(request);
  const body = await readJson(request, TransferRequestSchema);
  const outcome = await getRepository().createTransfer(principal.sessionId, { request: body, actorUid: principal.uid, idempotencyKey: key });
  return { transfer: outcome.transfer, replayed: outcome.replayed, view: await loadDistrictView(principal.sessionId) };
});
