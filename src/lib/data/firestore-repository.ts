import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { DistrictSchema, FacilitySchema, MAX_FACILITIES_PER_DISTRICT, type Facility } from "@/domain/schemas";
import { logger } from "@/lib/observability/logger";
import { seedTemplate, type DistrictRepository } from "./repository";

/**
 * Layout:
 *   demoSessions/{sessionId}                      → District document + metadata
 *   demoSessions/{sessionId}/facilities/{id}      → Facility document
 */
export function createFirestoreRepository(db: Firestore): DistrictRepository {
  const sessionRef = (sessionId: string) => db.collection("demoSessions").doc(sessionId);

  return {
    async ensureSession(sessionId) {
      return db.runTransaction(async (tx) => {
        const ref = sessionRef(sessionId);
        const existing = await tx.get(ref);
        if (existing.exists) return { created: false };

        const template = seedTemplate();
        tx.set(ref, { ...template.district, createdAt: new Date().toISOString() });
        for (const facility of template.facilities) {
          tx.set(ref.collection("facilities").doc(facility.id), facility);
        }
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
  };
}
