import "server-only";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { AuditEvent } from "@/domain/operations";
import { TransferSchema, type Transfer } from "@/domain/redistribution";
import { DistrictSchema, FacilitySchema, MAX_FACILITIES_PER_DISTRICT, type Facility } from "@/domain/schemas";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/observability/logger";
import {
  ACTIVITY_LIMIT,
  checkReplay,
  describeTransfer,
  newTransfer,
  runTransferAction,
  runUpdate,
  seedTemplate,
  transferAudit,
  TRANSFER_LIMIT,
  type DistrictRepository,
  type IdempotencyRecord,
} from "./repository";

/**
 * demoSessions/{sessionId}                                         District
 * demoSessions/{sessionId}/facilities/{facilityId}                 Facility
 * demoSessions/{sessionId}/facilities/{facilityId}/audit/{id}      AuditEvent
 * demoSessions/{sessionId}/facilities/{facilityId}/movements/{id}  InventoryMovement
 * demoSessions/{sessionId}/transfers/{transferId}                  Transfer
 * demoSessions/{sessionId}/idempotency/{key}                       IdempotencyRecord
 */
export function createFirestoreRepository(db: Firestore): DistrictRepository {
  const sessionRef = (sessionId: string) => db.collection("demoSessions").doc(sessionId);
  const facilityRef = (sessionId: string, facilityId: string) => sessionRef(sessionId).collection("facilities").doc(facilityId);
  const transferRef = (sessionId: string, transferId: string) => sessionRef(sessionId).collection("transfers").doc(transferId);
  const idemRef = (sessionId: string, key?: string) => (key ? sessionRef(sessionId).collection("idempotency").doc(key) : null);

  async function readFacility(tx: Transaction, sessionId: string, facilityId: string): Promise<Facility> {
    const doc = await tx.get(facilityRef(sessionId, facilityId));
    if (!doc.exists) throw new AppError("NOT_FOUND", "Centre not found.");
    return FacilitySchema.parse(doc.data());
  }

  async function readIdem(tx: Transaction, ref: ReturnType<typeof idemRef>): Promise<IdempotencyRecord | null> {
    if (!ref) return null;
    const doc = await tx.get(ref);
    return doc.exists ? (doc.data() as IdempotencyRecord) : null;
  }

  function writeAudit(tx: Transaction, sessionId: string, event: AuditEvent) {
    tx.set(facilityRef(sessionId, event.facilityId).collection("audit").doc(event.id), event);
  }

  return {
    async ensureSession(sessionId) {
      return db.runTransaction(async (tx) => {
        const ref = sessionRef(sessionId);
        const existing = await tx.get(ref);
        if (existing.exists) return { created: false };
        const template = seedTemplate();
        tx.set(ref, { ...template.district, createdAt: new Date().toISOString() });
        for (const facility of template.facilities) tx.set(ref.collection("facilities").doc(facility.id), facility);
        return { created: true };
      });
    },

    async getSnapshot(sessionId) {
      const ref = sessionRef(sessionId);
      const [sessionDoc, facilityDocs, transferDocs] = await Promise.all([
        ref.get(),
        ref.collection("facilities").orderBy("name").limit(MAX_FACILITIES_PER_DISTRICT).get(),
        ref.collection("transfers").orderBy("updatedAt", "desc").limit(TRANSFER_LIMIT).get(),
      ]);
      if (!sessionDoc.exists) return null;

      const facilities: Facility[] = [];
      for (const doc of facilityDocs.docs) {
        const parsed = FacilitySchema.safeParse(doc.data());
        if (parsed.success) facilities.push(parsed.data);
        else logger.warn("skipping invalid facility document", { facilityId: doc.id, issues: parsed.error.issues.length });
      }
      const transfers = transferDocs.docs.flatMap((d) => {
        const parsed = TransferSchema.safeParse(d.data());
        return parsed.success ? [parsed.data] : [];
      });
      return { district: DistrictSchema.parse(sessionDoc.data()), facilities, transfers };
    },

    async getFacility(sessionId, facilityId) {
      const ref = facilityRef(sessionId, facilityId);
      const [sessionDoc, facilityDoc, auditDocs] = await Promise.all([
        sessionRef(sessionId).get(),
        ref.get(),
        ref.collection("audit").orderBy("at", "desc").limit(ACTIVITY_LIMIT).get(),
      ]);
      if (!sessionDoc.exists || !facilityDoc.exists) return null;
      return {
        district: DistrictSchema.parse(sessionDoc.data()),
        facility: FacilitySchema.parse(facilityDoc.data()),
        activity: auditDocs.docs.map((d) => d.data() as AuditEvent),
      };
    },

    // Firestore retries contended transactions, so concurrent writes to the same documents serialise.
    async applyUpdate(sessionId, command) {
      const ref = facilityRef(sessionId, command.facilityId);
      const iref = idemRef(sessionId, command.idempotencyKey);
      return db.runTransaction(async (tx) => {
        const [current, prior] = await Promise.all([readFacility(tx, sessionId, command.facilityId), readIdem(tx, iref)]);
        if (prior) {
          checkReplay(prior, command.facilityId, command.update.kind);
          const audit = await tx.get(ref.collection("audit").doc(prior.auditId));
          return { facility: current, audit: audit.data() as AuditEvent, replayed: true };
        }
        const result = runUpdate(current, command);
        tx.set(ref, result.facility);
        writeAudit(tx, sessionId, result.audit);
        if (result.movement) tx.set(ref.collection("movements").doc(result.movement.id), result.movement);
        if (iref) tx.set(iref, { target: command.facilityId, kind: command.update.kind, auditId: result.audit.id } satisfies IdempotencyRecord);
        return { facility: result.facility, audit: result.audit, replayed: false };
      });
    },

    async createTransfer(sessionId, command) {
      const iref = idemRef(sessionId, command.idempotencyKey);
      return db.runTransaction(async (tx) => {
        const prior = await readIdem(tx, iref);
        if (prior) {
          checkReplay(prior, prior.target, "transfer.create");
          const existing = await tx.get(transferRef(sessionId, prior.target));
          return { transfer: TransferSchema.parse(existing.data()), replayed: true };
        }
        const [donor, receiver] = await Promise.all([
          readFacility(tx, sessionId, command.request.fromFacilityId),
          readFacility(tx, sessionId, command.request.toFacilityId),
        ]);
        const transfer = newTransfer(command, donor, receiver);
        tx.set(transferRef(sessionId, transfer.id), transfer);
        const text = describeTransfer(transfer, donor, receiver);
        writeAudit(tx, sessionId, transferAudit(transfer, donor.id, text.donor, command.actorUid));
        writeAudit(tx, sessionId, transferAudit(transfer, receiver.id, text.receiver, command.actorUid));
        if (iref) tx.set(iref, { target: transfer.id, kind: "transfer.create", auditId: transfer.id } satisfies IdempotencyRecord);
        return { transfer, replayed: false };
      });
    },

    async advanceTransfer(sessionId, command) {
      const ref = transferRef(sessionId, command.transferId);
      const iref = idemRef(sessionId, command.idempotencyKey);
      const kind = `transfer.${command.action}`;
      return db.runTransaction(async (tx) => {
        const [doc, prior] = await Promise.all([tx.get(ref), readIdem(tx, iref)]);
        if (!doc.exists) throw new AppError("NOT_FOUND", "Transfer not found.");
        const current: Transfer = TransferSchema.parse(doc.data());
        if (prior) {
          checkReplay(prior, command.transferId, kind);
          return { transfer: current, replayed: true };
        }
        const [donor, receiver] = await Promise.all([
          readFacility(tx, sessionId, current.fromFacilityId),
          readFacility(tx, sessionId, current.toFacilityId),
        ]);
        const result = runTransferAction(current, donor, receiver, command);
        tx.set(ref, result.transfer);
        tx.set(facilityRef(sessionId, donor.id), result.donor);
        tx.set(facilityRef(sessionId, receiver.id), result.receiver);
        const text = describeTransfer(result.transfer, result.donor, result.receiver);
        writeAudit(tx, sessionId, transferAudit(result.transfer, donor.id, text.donor, command.actorUid));
        writeAudit(tx, sessionId, transferAudit(result.transfer, receiver.id, text.receiver, command.actorUid));
        if (iref) tx.set(iref, { target: command.transferId, kind, auditId: result.transfer.id } satisfies IdempotencyRecord);
        return { transfer: result.transfer, replayed: false };
      });
    },
  };
}
