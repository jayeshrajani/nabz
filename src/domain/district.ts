import { footfallOutlook, forecastStock, type FootfallOutlook, type StockForecast } from "./forecast";
import { flagInterventions, type InterventionFlag } from "./interventions";
import type { AuditEvent } from "./operations";
import { suggestTransfers, type Transfer, type TransferSuggestion } from "./redistribution";
import { assessFacility, type FacilityAssessment, type RiskDomain } from "./risk";
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

export interface StrugglingFacility {
  facilityId: string;
  score: number;
  domains: RiskDomain[];
}

export interface DistrictView {
  district: District;
  summary: DistrictSummary;
  facilities: AssessedFacility[];
  /** Highest-burden centres, worst first. Score = 3 per critical signal + 1 per warning. */
  struggling: StrugglingFacility[];
  /** Centres automatically flagged to district administrators, with recommended interventions. */
  interventions: InterventionFlag[];
  /** District-wide daily arrivals, oldest first (sum across centres, aligned to the latest day). */
  footfallSeries: number[];
  transfers: Transfer[];
  suggestions: TransferSuggestion[];
}

export function rankStruggling(assessed: readonly AssessedFacility[], limit = 3): StrugglingFacility[] {
  return assessed
    .map(({ facility, assessment }) => {
      const score = assessment.signals.reduce((s, sig) => s + (sig.severity === "critical" ? 3 : 1), 0);
      const domains = [...new Set(assessment.signals.map((s) => s.domain))];
      return { facilityId: facility.id, score, domains, attendance: assessment.attendanceRate ?? 1 };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.attendance - b.attendance || a.facilityId.localeCompare(b.facilityId))
    .slice(0, limit)
    .map(({ facilityId, score, domains }) => ({ facilityId, score, domains }));
}

function districtFootfall(facilities: readonly Facility[]): number[] {
  const length = Math.max(0, ...facilities.map((f) => f.footfall.length));
  const out = new Array<number>(length).fill(0);
  for (const f of facilities) {
    const offset = length - f.footfall.length;
    f.footfall.forEach((v, i) => (out[offset + i]! += v));
  }
  return out;
}

export function buildDistrictView(district: District, facilities: readonly Facility[], transfers: readonly Transfer[] = []): DistrictView {
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

  const suggestions = suggestTransfers(facilities, transfers);
  return {
    district,
    summary,
    facilities: assessed,
    struggling: rankStruggling(assessed),
    interventions: flagInterventions(assessed, suggestions),
    footfallSeries: districtFootfall(facilities),
    transfers: [...transfers],
    suggestions,
  };
}

export interface FacilityDetail {
  district: District;
  facility: Facility;
  assessment: FacilityAssessment;
  stock: StockForecast[];
  footfall: FootfallOutlook;
  activity: AuditEvent[];
}

export function buildFacilityDetail(district: District, facility: Facility, activity: AuditEvent[]): FacilityDetail {
  return {
    district,
    facility,
    assessment: assessFacility(facility),
    stock: facility.medicines.map(forecastStock),
    footfall: footfallOutlook(facility.footfall),
    activity,
  };
}
