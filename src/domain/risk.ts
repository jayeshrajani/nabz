import type { Facility, MedicineStock } from "./schemas";

export type Severity = "healthy" | "warning" | "critical";
export type RiskDomain = "medicine" | "beds" | "staffing" | "diagnostics" | "footfall";

export type SignalCode =
  | "medicine.noHistory"
  | "medicine.out"
  | "medicine.runsOut"
  | "medicine.low"
  | "beds.none"
  | "beds.nearlyFull"
  | "beds.filling"
  | "staffing.absent"
  | "diagnostics.unavailable"
  | "diagnostics.low"
  | "footfall.surge";

export interface RiskSignal {
  domain: RiskDomain;
  severity: Exclude<Severity, "healthy">;
  /** Stable code + params so clients can render the signal in any language. */
  code: SignalCode;
  params: Record<string, string | number>;
  /** English rendering, used in logs, the API and AI grounding. */
  message: string;
  /** Identifier of the medicine/test the signal refers to, if any. */
  ref?: string;
}

export interface MedicineCoverage {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  averageDaily: number | null;
  /** null when history is insufficient; Infinity when consumption is zero. */
  daysOfCover: number | null;
  leadTimeDays: number;
  reorderLevel: number;
}

export interface FacilityAssessment {
  status: Severity;
  signals: RiskSignal[];
  medicines: MedicineCoverage[];
  bedOccupancy: number | null;
  attendanceRate: number | null;
  footfallToday: number | null;
  footfallAverage7d: number | null;
}

export const THRESHOLDS = {
  movingAverageWindow: 7,
  minHistoryDays: 3,
  bedOccupancyWarning: 0.85,
  bedOccupancyCritical: 0.95,
  attendanceWarning: 0.75,
  attendanceCritical: 0.5,
  /** Medicine coverage below lead time × this factor is a warning. */
  coverWarningFactor: 2,
  diagnosticKitDaysWarning: 3,
  /** Today's arrivals at or above this multiple of the usual level is a surge. */
  footfallSurgeRatio: 1.3,
} as const;

const SEVERITY_RANK: Record<Severity, number> = { healthy: 0, warning: 1, critical: 2 };

export function movingAverage(values: readonly number[], window: number = THRESHOLDS.movingAverageWindow): number | null {
  if (values.length < THRESHOLDS.minHistoryDays) return null;
  const slice = values.slice(-window);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

export function daysOfCover(quantity: number, averageDaily: number | null): number | null {
  if (averageDaily === null) return null;
  if (averageDaily <= 0) return Number.POSITIVE_INFINITY;
  return quantity / averageDaily;
}

export function assessMedicine(m: MedicineStock): { coverage: MedicineCoverage; signal: RiskSignal | null } {
  const averageDaily = movingAverage(m.dailyConsumption);
  // Stock reserved for approved outgoing transfers is not available to this centre.
  const available = m.quantity - m.reserved;
  const cover = daysOfCover(available, averageDaily);
  const coverage: MedicineCoverage = {
    id: m.id,
    name: m.name,
    unit: m.unit,
    quantity: available,
    averageDaily,
    daysOfCover: cover,
    leadTimeDays: m.leadTimeDays,
    reorderLevel: m.reorderLevel,
  };

  if (cover === null) {
    return {
      coverage,
      signal: { domain: "medicine", severity: "warning", ref: m.id, code: "medicine.noHistory", params: { name: m.name }, message: `${m.name}: not enough usage history yet` },
    };
  }
  const days = Number.isFinite(cover) ? Math.max(0, Math.round(cover)) : -1;
  if (available === 0) {
    return { coverage, signal: { domain: "medicine", severity: "critical", ref: m.id, code: "medicine.out", params: { name: m.name }, message: `${m.name} is out of stock` } };
  }
  if (cover < m.leadTimeDays) {
    return {
      coverage,
      signal: {
        domain: "medicine",
        severity: "critical",
        ref: m.id,
        code: "medicine.runsOut",
        params: { name: m.name, days, lead: m.leadTimeDays },
        message: `${m.name} may run out in ${formatDays(cover)}, restock takes ${m.leadTimeDays} days`,
      },
    };
  }
  if (available <= m.reorderLevel || cover < m.leadTimeDays * THRESHOLDS.coverWarningFactor) {
    return {
      coverage,
      signal: { domain: "medicine", severity: "warning", ref: m.id, code: "medicine.low", params: { name: m.name, days }, message: `${m.name} is running low, about ${formatDays(cover)} left` },
    };
  }
  return { coverage, signal: null };
}

export function assessFacility(f: Facility): FacilityAssessment {
  const signals: RiskSignal[] = [];
  const medicines: MedicineCoverage[] = [];

  for (const m of f.medicines) {
    const { coverage, signal } = assessMedicine(m);
    medicines.push(coverage);
    if (signal) signals.push(signal);
  }

  const bedOccupancy = f.beds.total > 0 ? f.beds.occupied / f.beds.total : null;
  if (bedOccupancy !== null) {
    const free = f.beds.total - f.beds.occupied;
    if (bedOccupancy >= THRESHOLDS.bedOccupancyCritical) {
      signals.push(
        free === 0
          ? { domain: "beds", severity: "critical", code: "beds.none", params: {}, message: "No beds free" }
          : { domain: "beds", severity: "critical", code: "beds.nearlyFull", params: { free, total: f.beds.total }, message: `Beds nearly full, ${free} of ${f.beds.total} free` },
      );
    } else if (bedOccupancy >= THRESHOLDS.bedOccupancyWarning) {
      signals.push({ domain: "beds", severity: "warning", code: "beds.filling", params: { free, total: f.beds.total }, message: `Beds filling up, ${free} of ${f.beds.total} free` });
    }
  }

  const attendanceRate = f.doctors.scheduled > 0 ? f.doctors.present / f.doctors.scheduled : null;
  if (attendanceRate !== null) {
    const gap = f.doctors.scheduled - f.doctors.present;
    const severity = attendanceRate < THRESHOLDS.attendanceCritical ? "critical" : attendanceRate < THRESHOLDS.attendanceWarning ? "warning" : null;
    if (severity) {
      signals.push({ domain: "staffing", severity, code: "staffing.absent", params: { gap, scheduled: f.doctors.scheduled }, message: `${gap} of ${f.doctors.scheduled} doctors absent today` });
    }
  }

  for (const t of f.diagnostics) {
    if (!t.available || t.kitsRemaining === 0) {
      signals.push({ domain: "diagnostics", severity: "critical", ref: t.id, code: "diagnostics.unavailable", params: { name: t.name }, message: `${t.name} test unavailable` });
    } else if (t.dailyUsage > 0 && t.kitsRemaining / t.dailyUsage < THRESHOLDS.diagnosticKitDaysWarning) {
      signals.push({ domain: "diagnostics", severity: "warning", ref: t.id, code: "diagnostics.low", params: { name: t.name }, message: `${t.name} kits running low` });
    }
  }

  const footfallToday = f.footfall.at(-1) ?? null;
  const usual = movingAverage(f.footfall.slice(0, -1));
  if (footfallToday !== null && usual !== null && usual > 0 && footfallToday >= usual * THRESHOLDS.footfallSurgeRatio) {
    const typical = Math.round(usual);
    signals.push({ domain: "footfall", severity: "warning", code: "footfall.surge", params: { today: footfallToday, usual: typical }, message: `Busier than usual, ${footfallToday} patients against about ${typical}` });
  }

  signals.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const status = signals.reduce<Severity>(
    (worst, s) => (SEVERITY_RANK[s.severity] > SEVERITY_RANK[worst] ? s.severity : worst),
    "healthy",
  );

  return {
    status,
    signals,
    medicines,
    bedOccupancy,
    attendanceRate,
    footfallToday,
    footfallAverage7d: movingAverage(f.footfall),
  };
}

export function formatDays(days: number): string {
  if (!Number.isFinite(days)) return "no recent use";
  if (days < 1) return "under a day";
  const rounded = Math.round(days);
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}
