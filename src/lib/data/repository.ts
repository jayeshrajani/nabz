import { applyFacilityUpdate, type AuditEvent, type FacilityUpdate, type UpdateResult } from "@/domain/operations";
import { buildSeedDistrict, buildSeedFacilities } from "@/domain/seed";
import type { District, Facility } from "@/domain/schemas";
import { AppError } from "@/lib/errors/app-error";

export const ACTIVITY_LIMIT = 20;
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;

export interface SessionSnapshot {
  district: District;
  facilities: Facility[];
}

export interface FacilityRecord {
  district: District;
  facility: Facility;
  activity: AuditEvent[];
}

export interface UpdateCommand {
  facilityId: string;
  update: FacilityUpdate;
  actorUid: string;
  idempotencyKey?: string;
}

export interface UpdateOutcome {
  facility: Facility;
  audit: AuditEvent;
  replayed: boolean;
}

export interface IdempotencyRecord {
  facilityId: string;
  kind: FacilityUpdate["kind"];
  audit: AuditEvent;
}

/** All operations are scoped to a sessionId resolved server-side from the caller's identity. */
export interface DistrictRepository {
  ensureSession(sessionId: string): Promise<{ created: boolean }>;
  getSnapshot(sessionId: string): Promise<SessionSnapshot | null>;
  getFacility(sessionId: string, facilityId: string): Promise<FacilityRecord | null>;
  applyUpdate(sessionId: string, command: UpdateCommand): Promise<UpdateOutcome>;
}

export function seedTemplate(now: Date = new Date()): SessionSnapshot {
  const iso = now.toISOString();
  return { district: buildSeedDistrict(iso.slice(0, 10)), facilities: buildSeedFacilities(iso) };
}

export function checkReplay(record: IdempotencyRecord, command: UpdateCommand): void {
  if (record.facilityId !== command.facilityId || record.kind !== command.update.kind) {
    throw new AppError("CONFLICT", "Idempotency key was already used for a different request.");
  }
}

export function runUpdate(facility: Facility, command: UpdateCommand): UpdateResult {
  return applyFacilityUpdate(facility, command.update, { actorUid: command.actorUid, at: new Date().toISOString(), id: crypto.randomUUID() });
}

interface MemorySession extends SessionSnapshot {
  activity: Map<string, AuditEvent[]>;
  idempotency: Map<string, IdempotencyRecord>;
}

export function createMemoryRepository(): DistrictRepository {
  const sessions = new Map<string, MemorySession>();

  return {
    async ensureSession(sessionId) {
      if (sessions.has(sessionId)) return { created: false };
      sessions.set(sessionId, { ...structuredClone(seedTemplate()), activity: new Map(), idempotency: new Map() });
      return { created: true };
    },

    async getSnapshot(sessionId) {
      const s = sessions.get(sessionId);
      return s ? structuredClone({ district: s.district, facilities: s.facilities }) : null;
    },

    async getFacility(sessionId, facilityId) {
      const s = sessions.get(sessionId);
      const facility = s?.facilities.find((f) => f.id === facilityId);
      if (!s || !facility) return null;
      return structuredClone({ district: s.district, facility, activity: (s.activity.get(facilityId) ?? []).slice(0, ACTIVITY_LIMIT) });
    },

    async applyUpdate(sessionId, command) {
      const s = sessions.get(sessionId);
      const index = s?.facilities.findIndex((f) => f.id === command.facilityId) ?? -1;
      if (!s || index < 0) throw new AppError("NOT_FOUND", "Centre not found.");

      const prior = command.idempotencyKey ? s.idempotency.get(command.idempotencyKey) : undefined;
      if (prior) {
        checkReplay(prior, command);
        return structuredClone({ facility: s.facilities[index]!, audit: prior.audit, replayed: true });
      }

      const result = runUpdate(s.facilities[index]!, command);
      s.facilities[index] = result.facility;
      s.activity.set(command.facilityId, [result.audit, ...(s.activity.get(command.facilityId) ?? [])].slice(0, 200));
      if (command.idempotencyKey) s.idempotency.set(command.idempotencyKey, { facilityId: command.facilityId, kind: command.update.kind, audit: result.audit });
      return structuredClone({ facility: result.facility, audit: result.audit, replayed: false });
    },
  };
}
