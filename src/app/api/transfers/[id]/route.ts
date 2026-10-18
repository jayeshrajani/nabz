import { z } from "zod";
import { TransferActionSchema } from "@/domain/redistribution";
import { apiHandler, type ApiContext } from "@/lib/api/handler";
import { idempotencyKey, readJson } from "@/lib/api/request";
import { can } from "@/lib/auth/roles";
import { authenticate } from "@/lib/auth/server";
import { getRepository } from "@/lib/data";
import { loadDistrictView } from "@/lib/data/views";
import { AppError } from "@/lib/errors/app-error";

const BodySchema = z.object({ action: TransferActionSchema });
const TRANSFER_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Human-approved workflow step: approve (reserve) → dispatch → receive, or cancel. */
export const POST = apiHandler("transfer.advance", async ({ request, route }: ApiContext<RouteContext<"/api/transfers/[id]">>) => {
  const principal = await authenticate(request);
  const { action } = await readJson(request, BodySchema);
  const capability = action === "approve" || action === "cancel" ? "transfer:approve" : "facility:write";
  if (!can(principal, capability)) throw new AppError("FORBIDDEN", `Missing ${capability} capability.`);

  const transferId = (await route.params).id;
  if (!TRANSFER_ID.test(transferId)) throw new AppError("NOT_FOUND", "Transfer not found.");

  const outcome = await getRepository().advanceTransfer(principal.sessionId, {
    transferId,
    action,
    actorUid: principal.uid,
    idempotencyKey: idempotencyKey(request),
  });
  return { transfer: outcome.transfer, replayed: outcome.replayed, view: await loadDistrictView(principal.sessionId) };
});
