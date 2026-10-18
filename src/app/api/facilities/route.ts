import { apiHandler } from "@/lib/api/handler";
import { authorize } from "@/lib/api/guard";
import { loadDistrictView } from "@/lib/data/views";

export const GET = apiHandler("district.read", async ({ request }) => {
  const principal = await authorize(request, "district:read", "read");
  return loadDistrictView(principal.sessionId);
});
