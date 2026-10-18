import { TransferRequestSchema } from "@/domain/redistribution";
import { apiHandler } from "@/lib/api/handler";
import { authorize } from "@/lib/api/guard";
import { idempotencyKey, readJson } from "@/lib/api/request";
import { getRepository } from "@/lib/data";
import { loadDistrictView } from "@/lib/data/views";

/** Proposes a transfer. Donor reserve is re-checked server-side; nothing moves until approval and dispatch. */
export const POST = apiHandler("transfer.create", async ({ request }) => {
  const principal = await authorize(request, "facility:write", "write");
  const key = idempotencyKey(request);
  const body = await readJson(request, TransferRequestSchema);
  const outcome = await getRepository().createTransfer(principal.sessionId, { request: body, actorUid: principal.uid, idempotencyKey: key });
  return { transfer: outcome.transfer, replayed: outcome.replayed, view: await loadDistrictView(principal.sessionId) };
});
