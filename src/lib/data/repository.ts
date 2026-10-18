import { buildSeedDistrict, buildSeedFacilities } from "@/domain/seed";
import type { District, Facility } from "@/domain/schemas";

export interface SessionSnapshot {
  district: District;
  facilities: Facility[];
}

/** All operations are scoped to a sessionId resolved server-side from the caller's identity. */
export interface DistrictRepository {
  ensureSession(sessionId: string): Promise<{ created: boolean }>;
  getSnapshot(sessionId: string): Promise<SessionSnapshot | null>;
}

export function seedTemplate(now: Date = new Date()): SessionSnapshot {
  const iso = now.toISOString();
  return { district: buildSeedDistrict(iso.slice(0, 10)), facilities: buildSeedFacilities(iso) };
}

export function createMemoryRepository(): DistrictRepository {
  const sessions = new Map<string, SessionSnapshot>();
  return {
    async ensureSession(sessionId) {
      if (sessions.has(sessionId)) return { created: false };
      sessions.set(sessionId, structuredClone(seedTemplate()));
      return { created: true };
    },
    async getSnapshot(sessionId) {
      const snapshot = sessions.get(sessionId);
      return snapshot ? structuredClone(snapshot) : null;
    },
  };
}
