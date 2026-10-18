import { buildFacilityDetail } from "@/domain/district";
import { apiHandler, type ApiContext } from "@/lib/api/handler";
import { authorize } from "@/lib/api/guard";
import { parseId } from "@/lib/api/request";
import { getRepository } from "@/lib/data";
import { AppError } from "@/lib/errors/app-error";

export const GET = apiHandler("facility.read", async ({ request, route }: ApiContext<RouteContext<"/api/facilities/[id]">>) => {
  const principal = await authorize(request, "district:read", "read");
  const id = parseId((await route.params).id);

  const record = await getRepository().getFacility(principal.sessionId, id);
  if (!record) throw new AppError("NOT_FOUND", "Centre not found.");
  return buildFacilityDetail(record.district, record.facility, record.activity);
});
