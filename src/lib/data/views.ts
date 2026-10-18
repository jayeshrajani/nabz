import "server-only";
import { buildDistrictView, type DistrictView } from "@/domain/district";
import { AppError } from "@/lib/errors/app-error";
import { getRepository } from "./index";

export async function loadDistrictView(sessionId: string): Promise<DistrictView> {
  const snapshot = await getRepository().getSnapshot(sessionId);
  if (!snapshot) throw new AppError("NOT_FOUND", "No session dataset. Call POST /api/session first.");
  return buildDistrictView(snapshot.district, snapshot.facilities, snapshot.transfers);
}
