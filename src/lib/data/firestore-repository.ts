import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import type { AuditEvent } from "@/domain/operations";
import { DistrictSchema, FacilitySchema, MAX_FACILITIES_PER_DISTRICT, type Facility } from "@/domain/schemas";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/observability/logger";
import { ACTIVITY_LIMIT, checkReplay, runUpdate, seedTemplate, type DistrictRepository, type IdempotencyRecord } from "./repository";

/**
 * demoSessions/{sessionId}                                   District
 * demoSessions/{sessionId}/facilities/{facilityId}           Facility
 * demoSessions/{sessionId}/facilities/{facilityId}/audit/{id}      AuditEvent
 * demoSessions/{sessionId}/facilities/{facilityId}/movements/{id}  InventoryMovement
 * demoSessions/{sessionId}/idempotency/{key}                 IdempotencyRecord
 */
export function createFirestoreRepository(db: Firestore): DistrictRepository {
  const sessionRef = (sessionId: string) => db.collection("demoSessions").doc(sessionId);
  const facilityRef = (sessionId: string, facilityId: string) => sessionRef(sessionId).collection("facilities").doc(facilityId);

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
      const [sessionDoc, facilityDocs] = await Promise.all([
        ref.get(),
        ref.collection("facilities").orderBy("name").limit(MAX_FACILITIES_PER_DISTRICT).get(),
      ]);
      if (!sessionDoc.exists) return null;

      const district = DistrictSchema.parse(sessionDoc.data());
      const facilities: Facility[] = [];
      for (const doc of facilityDocs.docs) {
        const parsed = FacilitySchema.safeParse(doc.data());
        if (parsed.success) facilities.push(parsed.data);
        else logger.warn("skipping invalid facility document", { facilityId: doc.id, issues: parsed.error.issues.length });
      }
      return { district, facilities };
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

    async applyUpdate(sessionId, command) {
      const ref = facilityRef(sessionId, command.facilityId);
      const idemRef = command.idempotencyKey ? sessionRef(sessionId).collection("idempotency").doc(command.idempotencyKey) : null;

      // Firestore retries the transaction on contention, so concurrent updates serialise on the facility document.
      return db.runTransaction(async (tx) => {
        const [facilityDoc, idemDoc] = await Promise.all([tx.get(ref), idemRef ? tx.get(idemRef) : Promise.resolve(null)]);
        if (!facilityDoc.exists) throw new AppError("NOT_FOUND", "Centre not found.");
        const current = FacilitySchema.parse(facilityDoc.data());

        if (idemDoc?.exists) {
          const prior = idemDoc.data() as IdempotencyRecord;
          checkReplay(prior, command);
          return { facility: current, audit: prior.audit, replayed: true };
        }

        const result = runUpdate(current, command);
        tx.set(ref, result.facility);
        tx.set(ref.collection("audit").doc(result.audit.id), result.audit);
        if (result.movement) tx.set(ref.collection("movements").doc(result.movement.id), result.movement);
        if (idemRef) tx.set(idemRef, { facilityId: command.facilityId, kind: command.update.kind, audit: result.audit } satisfies IdempotencyRecord);
        return { facility: result.facility, audit: result.audit, replayed: false };
      });
    },
  };
}
