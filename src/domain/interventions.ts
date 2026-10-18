import type { TransferSuggestion } from "./redistribution";
import type { FacilityAssessment, SignalCode } from "./risk";
import type { Facility } from "./schemas";

/** Underperforming = gaps the centre should control; under-resourced = demand beyond its capacity. */
export type InterventionKind = "underperforming" | "underResourced";
export type InterventionAction = "deployRelief" | "approveTransfer" | "emergencyRestock" | "referPatients" | "restockTests" | "surgeSupport";
export type InterventionPriority = "urgent" | "high";

export interface InterventionFlag {
  facilityId: string;
  priority: InterventionPriority;
  score: number;
  kinds: InterventionKind[];
  actions: InterventionAction[];
  /** Today's patients per doctor present; null when no doctor is present or rostered. */
  patientsPerDoctor: number | null;
}

/** Daily OPD load per doctor above which a centre is treated as under-resourced. */
export const PATIENTS_PER_DOCTOR_LIMIT = 60;
const MIN_SCORE_TO_FLAG = 2;

const UNDERPERFORMING: ReadonlySet<SignalCode> = new Set(["staffing.absent", "medicine.out", "medicine.runsOut", "diagnostics.unavailable"]);
const UNDER_RESOURCED: ReadonlySet<SignalCode> = new Set(["beds.none", "beds.nearlyFull", "beds.filling", "footfall.surge"]);

interface Assessed {
  facility: Facility;
  assessment: FacilityAssessment;
}

export function flagInterventions(assessed: readonly Assessed[], suggestions: readonly TransferSuggestion[]): InterventionFlag[] {
  const transferable = new Set(suggestions.map((s) => s.toFacilityId));

  return assessed
    .flatMap(({ facility, assessment }) => {
      const kinds = new Set<InterventionKind>();
      const actions = new Set<InterventionAction>();
      let score = 0;

      for (const s of assessment.signals) {
        score += s.severity === "critical" ? 3 : 1;
        if (UNDERPERFORMING.has(s.code)) kinds.add("underperforming");
        if (UNDER_RESOURCED.has(s.code)) kinds.add("underResourced");
        if (s.code === "staffing.absent") actions.add("deployRelief");
        if (s.code === "medicine.out" || s.code === "medicine.runsOut") actions.add(transferable.has(facility.id) ? "approveTransfer" : "emergencyRestock");
        if (s.code === "beds.none" || s.code === "beds.nearlyFull") actions.add("referPatients");
        if (s.code === "diagnostics.unavailable") actions.add("restockTests");
        if (s.code === "footfall.surge") actions.add("surgeSupport");
      }

      const today = assessment.footfallToday ?? 0;
      const present = facility.doctors.present;
      const patientsPerDoctor = present > 0 ? Math.round(today / present) : null;
      if ((patientsPerDoctor ?? 0) > PATIENTS_PER_DOCTOR_LIMIT || (present === 0 && today > 0)) {
        kinds.add("underResourced");
        actions.add("surgeSupport");
        score += 2;
      }

      const critical = assessment.status === "critical";
      if (!critical && score < MIN_SCORE_TO_FLAG) return [];
      const priority: InterventionPriority = critical ? "urgent" : "high";
      return [{ facilityId: facility.id, priority, score, kinds: [...kinds], actions: [...actions], patientsPerDoctor }];
    })
    .sort((a, b) => b.score - a.score || a.facilityId.localeCompare(b.facilityId));
}
