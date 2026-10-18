import { applyFacilityUpdate, type AuditEvent, type FacilityUpdate, type UpdateResult } from "@/domain/operations";
import { applyTransferAction, createTransfer, type Transfer, type TransferAction, type TransferRequest, type TransferResult } from "@/domain/redistribution";
import { buildSeedDistrict, buildSeedFacilities } from "@/domain/seed";
import type { District, Facility } from "@/domain/schemas";
import { AppError } from "@/lib/errors/app-error";

export const ACTIVITY_LIMIT = 20;
export const TRANSFER_LIMIT = 50;
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;

export interface SessionSnapshot {
  district: District;
  facilities: Facility[];
  transfers: Transfer[];
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

export interface CreateTransferCommand {
  request: TransferRequest;
  actorUid: string;
  idempotencyKey?: string;
}

export interface AdvanceTransferCommand {
  transferId: string;
  action: TransferAction;
  actorUid: string;
  idempotencyKey?: string;
}

export interface TransferOutcome {
  transfer: Transfer;
  replayed: boolean;
}

/** `target` is a facility id for updates or a transfer id for transfer actions. */
export interface IdempotencyRecord {
  target: string;
  kind: string;
  auditId: string;
}

/** All operations are scoped to a sessionId resolved server-side from the caller's identity. */
export interface DistrictRepository {
  ensureSession(sessionId: string): Promise<{ created: boolean }>;
  getSnapshot(sessionId: string): Promise<SessionSnapshot | null>;
  getFacility(sessionId: string, facilityId: string): Promise<FacilityRecord | null>;
  applyUpdate(sessionId: string, command: UpdateCommand): Promise<UpdateOutcome>;
  createTransfer(sessionId: string, command: CreateTransferCommand): Promise<TransferOutcome>;
  advanceTransfer(sessionId: string, command: AdvanceTransferCommand): Promise<TransferOutcome>;
}

export function seedTemplate(now: Date = new Date()): Omit<SessionSnapshot, "transfers"> {
  const iso = now.toISOString();
  return { district: buildSeedDistrict(iso.slice(0, 10)), facilities: buildSeedFacilities(iso) };
}

export function checkReplay(record: IdempotencyRecord, target: string, kind: string): void {
  if (record.target !== target || record.kind !== kind) {
    throw new AppError("CONFLICT", "Idempotency key was already used for a different request.");
  }
}

export function runUpdate(facility: Facility, command: UpdateCommand): UpdateResult {
  return applyFacilityUpdate(facility, command.update, { actorUid: command.actorUid, at: new Date().toISOString(), id: crypto.randomUUID() });
}

export function newTransfer(command: CreateTransferCommand, donor: Facility, receiver: Facility): Transfer {
  return createTransfer(command.request, donor, receiver, { id: crypto.randomUUID(), actorUid: command.actorUid, at: new Date().toISOString() });
}

export function runTransferAction(transfer: Transfer, donor: Facility, receiver: Facility, command: AdvanceTransferCommand): TransferResult {
  return applyTransferAction(transfer, donor, receiver, command.action, { actorUid: command.actorUid, at: new Date().toISOString() });
}

export function transferAudit(t: Transfer, facilityId: string, summary: string, actorUid: string): AuditEvent {
  return { id: crypto.randomUUID(), facilityId, kind: "transfer", summary, actorUid, at: t.updatedAt };
}

const STATUS_TEXT: Record<Transfer["status"], string> = {
  proposed: "proposed",
  approved: "approved (stock reserved)",
  dispatched: "dispatched",
  received: "received",
  cancelled: "cancelled",
};

export function describeTransfer(t: Transfer, donor: Facility, receiver: Facility): { donor: string; receiver: string } {
  const name = donor.medicines.find((m) => m.id === t.medicineId)?.name ?? t.medicineId;
  return {
    donor: `Transfer of ${t.quantity} × ${name} to ${receiver.name} ${STATUS_TEXT[t.status]}`,
    receiver: `Transfer of ${t.quantity} × ${name} from ${donor.name} ${STATUS_TEXT[t.status]}`,
  };
}

interface MemorySession {
  district: District;
  facilities: Facility[];
  transfers: Transfer[];
  activity: Map<string, AuditEvent[]>;
  idempotency: Map<string, IdempotencyRecord & { audit?: AuditEvent }>;
}

export function createMemoryRepository(): DistrictRepository {
  const sessions = new Map<string, MemorySession>();

  const session = (id: string) => {
    const s = sessions.get(id);
    if (!s) throw new AppError("NOT_FOUND", "No session dataset. Call POST /api/session first.");
    return s;
  };
  const facility = (s: MemorySession, id: string) => {
    const f = s.facilities.find((x) => x.id === id);
    if (!f) throw new AppError("NOT_FOUND", "Centre not found.");
    return f;
  };
  const replace = (s: MemorySession, f: Facility) => {
    s.facilities = s.facilities.map((x) => (x.id === f.id ? f : x));
  };
  const log = (s: MemorySession, e: AuditEvent) => {
    s.activity.set(e.facilityId, [e, ...(s.activity.get(e.facilityId) ?? [])].slice(0, 200));
  };

  return {
    async ensureSession(sessionId) {
      if (sessions.has(sessionId)) return { created: false };
      sessions.set(sessionId, { ...structuredClone(seedTemplate()), transfers: [], activity: new Map(), idempotency: new Map() });
      return { created: true };
    },

    async getSnapshot(sessionId) {
      const s = sessions.get(sessionId);
      return s ? structuredClone({ district: s.district, facilities: s.facilities, transfers: s.transfers.slice(0, TRANSFER_LIMIT) }) : null;
    },

    async getFacility(sessionId, facilityId) {
      const s = sessions.get(sessionId);
      const f = s?.facilities.find((x) => x.id === facilityId);
      if (!s || !f) return null;
      return structuredClone({ district: s.district, facility: f, activity: (s.activity.get(facilityId) ?? []).slice(0, ACTIVITY_LIMIT) });
    },

    async applyUpdate(sessionId, command) {
      const s = session(sessionId);
      const current = facility(s, command.facilityId);
      const prior = command.idempotencyKey ? s.idempotency.get(command.idempotencyKey) : undefined;
      if (prior) {
        checkReplay(prior, command.facilityId, command.update.kind);
        return structuredClone({ facility: current, audit: prior.audit!, replayed: true });
      }
      const result = runUpdate(current, command);
      replace(s, result.facility);
      log(s, result.audit);
      if (command.idempotencyKey) s.idempotency.set(command.idempotencyKey, { target: command.facilityId, kind: command.update.kind, auditId: result.audit.id, audit: result.audit });
      return structuredClone({ facility: result.facility, audit: result.audit, replayed: false });
    },

    async createTransfer(sessionId, command) {
      const s = session(sessionId);
      const prior = command.idempotencyKey ? s.idempotency.get(command.idempotencyKey) : undefined;
      if (prior) {
        checkReplay(prior, prior.target, "transfer.create");
        return structuredClone({ transfer: s.transfers.find((t) => t.id === prior.target)!, replayed: true });
      }
      const donor = facility(s, command.request.fromFacilityId);
      const receiver = facility(s, command.request.toFacilityId);
      const transfer = newTransfer(command, donor, receiver);
      s.transfers = [transfer, ...s.transfers];
      const text = describeTransfer(transfer, donor, receiver);
      log(s, transferAudit(transfer, donor.id, text.donor, command.actorUid));
      log(s, transferAudit(transfer, receiver.id, text.receiver, command.actorUid));
      if (command.idempotencyKey) s.idempotency.set(command.idempotencyKey, { target: transfer.id, kind: "transfer.create", auditId: transfer.id });
      return structuredClone({ transfer, replayed: false });
    },

    async advanceTransfer(sessionId, command) {
      const s = session(sessionId);
      const current = s.transfers.find((t) => t.id === command.transferId);
      if (!current) throw new AppError("NOT_FOUND", "Transfer not found.");
      const kind = `transfer.${command.action}`;
      const prior = command.idempotencyKey ? s.idempotency.get(command.idempotencyKey) : undefined;
      if (prior) {
        checkReplay(prior, command.transferId, kind);
        return structuredClone({ transfer: current, replayed: true });
      }
      const result = runTransferAction(current, facility(s, current.fromFacilityId), facility(s, current.toFacilityId), command);
      replace(s, result.donor);
      replace(s, result.receiver);
      s.transfers = s.transfers.map((t) => (t.id === current.id ? result.transfer : t));
      const text = describeTransfer(result.transfer, result.donor, result.receiver);
      log(s, transferAudit(result.transfer, result.donor.id, text.donor, command.actorUid));
      log(s, transferAudit(result.transfer, result.receiver.id, text.receiver, command.actorUid));
      if (command.idempotencyKey) s.idempotency.set(command.idempotencyKey, { target: command.transferId, kind, auditId: result.transfer.id });
      return structuredClone({ transfer: result.transfer, replayed: false });
    },
  };
}
