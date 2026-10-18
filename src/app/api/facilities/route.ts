import { buildDistrictView } from "@/domain/district";
import { apiHandler } from "@/lib/api/handler";
import { authenticate } from "@/lib/auth/server";
import { can } from "@/lib/auth/roles";
import { getRepository } from "@/lib/data";
import { AppError } from "@/lib/errors/app-error";

export const GET = apiHandler("district.read", async ({ request }) => {
  const principal = await authenticate(request);
  if (!can(principal, "district:read")) throw new AppError("FORBIDDEN", "Missing district:read capability.");

  const snapshot = await getRepository().getSnapshot(principal.sessionId);
  if (!snapshot) throw new AppError("NOT_FOUND", "No session dataset. Call POST /api/session first.");
  return buildDistrictView(snapshot.district, snapshot.facilities);
});
