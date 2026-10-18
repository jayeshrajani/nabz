import { apiHandler } from "@/lib/api/handler";
import { authenticate } from "@/lib/auth/server";
import { can } from "@/lib/auth/roles";
import { loadDistrictView } from "@/lib/data/views";
import { AppError } from "@/lib/errors/app-error";

export const GET = apiHandler("district.read", async ({ request }) => {
  const principal = await authenticate(request);
  if (!can(principal, "district:read")) throw new AppError("FORBIDDEN", "Missing district:read capability.");
  return loadDistrictView(principal.sessionId);
});
