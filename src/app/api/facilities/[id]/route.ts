import { buildFacilityDetail } from "@/domain/district";
import { apiHandler, type ApiContext } from "@/lib/api/handler";
import { parseId } from "@/lib/api/request";
import { can } from "@/lib/auth/roles";
import { authenticate } from "@/lib/auth/server";
import { getRepository } from "@/lib/data";
import { AppError } from "@/lib/errors/app-error";

export const GET = apiHandler("facility.read", async ({ request, route }: ApiContext<RouteContext<"/api/facilities/[id]">>) => {
  const principal = await authenticate(request);
  if (!can(principal, "district:read")) throw new AppError("FORBIDDEN", "Missing district:read capability.");
  const id = parseId((await route.params).id);

  const record = await getRepository().getFacility(principal.sessionId, id);
  if (!record) throw new AppError("NOT_FOUND", "Centre not found.");
  return buildFacilityDetail(record.district, record.facility, record.activity);
});
