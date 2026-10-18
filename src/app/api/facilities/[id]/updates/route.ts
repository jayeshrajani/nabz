import { buildFacilityDetail } from "@/domain/district";
import { FacilityUpdateSchema } from "@/domain/operations";
import { apiHandler, type ApiContext } from "@/lib/api/handler";
import { parseId, readJson } from "@/lib/api/request";
import { can } from "@/lib/auth/roles";
import { authenticate } from "@/lib/auth/server";
import { getRepository } from "@/lib/data";
import { IDEMPOTENCY_KEY } from "@/lib/data/repository";
import { AppError } from "@/lib/errors/app-error";

/** Records one operational update (beds, attendance, footfall, stock movement or test availability). */
export const POST = apiHandler(
  "facility.update",
  async ({ request, route }: ApiContext<RouteContext<"/api/facilities/[id]/updates">>) => {
    const principal = await authenticate(request);
    if (!can(principal, "facility:write")) throw new AppError("FORBIDDEN", "Missing facility:write capability.");
    const facilityId = parseId((await route.params).id);

    const key = request.headers.get("idempotency-key") ?? undefined;
    if (key !== undefined && !IDEMPOTENCY_KEY.test(key)) throw new AppError("VALIDATION_FAILED", "Malformed Idempotency-Key header.");

    const update = await readJson(request, FacilityUpdateSchema);
    const repo = getRepository();
    const outcome = await repo.applyUpdate(principal.sessionId, { facilityId, update, actorUid: principal.uid, idempotencyKey: key });

    const record = await repo.getFacility(principal.sessionId, facilityId);
    if (!record) throw new AppError("NOT_FOUND", "Centre not found.");
    return { replayed: outcome.replayed, audit: outcome.audit, detail: buildFacilityDetail(record.district, record.facility, record.activity) };
  },
);
