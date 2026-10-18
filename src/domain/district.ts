import { assessFacility, type FacilityAssessment } from "./risk";
import type { District, Facility } from "./schemas";

export interface AssessedFacility {
  facility: Facility;
  assessment: FacilityAssessment;
}

export interface DistrictSummary {
  facilities: number;
  critical: number;
  warning: number;
  stockOutRisks: number;
  bedsTotal: number;
  bedsOccupied: number;
  footfallToday: number;
  doctorGap: number;
  diagnosticShortages: number;
  lastUpdated: string | null;
}

export interface DistrictView {
  district: District;
  summary: DistrictSummary;
  facilities: AssessedFacility[];
}

export function buildDistrictView(district: District, facilities: readonly Facility[]): DistrictView {
  const assessed = facilities.map((facility) => ({ facility, assessment: assessFacility(facility) }));
  const summary: DistrictSummary = {
    facilities: assessed.length,
    critical: 0,
    warning: 0,
    stockOutRisks: 0,
    bedsTotal: 0,
    bedsOccupied: 0,
    footfallToday: 0,
    doctorGap: 0,
    diagnosticShortages: 0,
    lastUpdated: null,
  };

  for (const { facility, assessment } of assessed) {
    if (assessment.status === "critical") summary.critical++;
    if (assessment.status === "warning") summary.warning++;
    summary.stockOutRisks += assessment.signals.filter((s) => s.domain === "medicine" && s.severity === "critical").length;
    summary.diagnosticShortages += assessment.signals.filter((s) => s.domain === "diagnostics" && s.severity === "critical").length;
    summary.bedsTotal += facility.beds.total;
    summary.bedsOccupied += facility.beds.occupied;
    summary.footfallToday += assessment.footfallToday ?? 0;
    summary.doctorGap += facility.doctors.scheduled - facility.doctors.present;
    if (!summary.lastUpdated || facility.updatedAt > summary.lastUpdated) summary.lastUpdated = facility.updatedAt;
  }

  return { district, summary, facilities: assessed };
}
