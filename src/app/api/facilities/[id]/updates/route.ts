import { buildFacilityDetail } from "@/domain/district";
import { FacilityUpdateSchema } from "@/domain/operations";
import { apiHandler, type ApiContext } from "@/lib/api/handler";
import { authorize } from "@/lib/api/guard";
import { idempotencyKey, parseId, readJson } from "@/lib/api/request";
import { getRepository } from "@/lib/data";
import { AppError } from "@/lib/errors/app-error";

/** Records one operational update (beds, attendance, footfall, stock movement or test availability). */
export const POST = apiHandler(
  "facility.update",
  async ({ request, route }: ApiContext<RouteContext<"/api/facilities/[id]/updates">>) => {
    const principal = await authorize(request, "facility:write", "write");
    const facilityId = parseId((await route.params).id);
    const key = idempotencyKey(request);

    const update = await readJson(request, FacilityUpdateSchema);
    const repo = getRepository();
    const outcome = await repo.applyUpdate(principal.sessionId, { facilityId, update, actorUid: principal.uid, idempotencyKey: key });

    const record = await repo.getFacility(principal.sessionId, facilityId);
    if (!record) throw new AppError("NOT_FOUND", "Centre not found.");
    return { replayed: outcome.replayed, audit: outcome.audit, detail: buildFacilityDetail(record.district, record.facility, record.activity) };
  },
);
