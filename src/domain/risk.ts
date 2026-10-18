import type { Facility, MedicineStock } from "./schemas";

export type Severity = "healthy" | "warning" | "critical";
export type RiskDomain = "medicine" | "beds" | "staffing" | "diagnostics";

export interface RiskSignal {
  domain: RiskDomain;
  severity: Exclude<Severity, "healthy">;
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
  const cover = daysOfCover(m.quantity, averageDaily);
  const coverage: MedicineCoverage = {
    id: m.id,
    name: m.name,
    unit: m.unit,
    quantity: m.quantity,
    averageDaily,
    daysOfCover: cover,
    leadTimeDays: m.leadTimeDays,
    reorderLevel: m.reorderLevel,
  };

  if (cover === null) {
    return {
      coverage,
      signal: { domain: "medicine", severity: "warning", ref: m.id, message: `${m.name}: insufficient consumption history to forecast` },
    };
  }
  if (m.quantity === 0 || cover < m.leadTimeDays) {
    return {
      coverage,
      signal: {
        domain: "medicine",
        severity: "critical",
        ref: m.id,
        message: `${m.name}: ${formatDays(cover)} of cover, below ${m.leadTimeDays}-day replenishment lead time`,
      },
    };
  }
  if (m.quantity <= m.reorderLevel || cover < m.leadTimeDays * THRESHOLDS.coverWarningFactor) {
    return {
      coverage,
      signal: { domain: "medicine", severity: "warning", ref: m.id, message: `${m.name}: ${formatDays(cover)} of cover, reorder advised` },
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
    const pct = Math.round(bedOccupancy * 100);
    if (bedOccupancy >= THRESHOLDS.bedOccupancyCritical) {
      signals.push({ domain: "beds", severity: "critical", message: `Bed occupancy at ${pct}% (${f.beds.total - f.beds.occupied} free)` });
    } else if (bedOccupancy >= THRESHOLDS.bedOccupancyWarning) {
      signals.push({ domain: "beds", severity: "warning", message: `Bed occupancy at ${pct}%` });
    }
  }

  const attendanceRate = f.doctors.scheduled > 0 ? f.doctors.present / f.doctors.scheduled : null;
  if (attendanceRate !== null) {
    const gap = f.doctors.scheduled - f.doctors.present;
    if (attendanceRate < THRESHOLDS.attendanceCritical) {
      signals.push({ domain: "staffing", severity: "critical", message: `${gap} of ${f.doctors.scheduled} scheduled doctors absent` });
    } else if (attendanceRate < THRESHOLDS.attendanceWarning) {
      signals.push({ domain: "staffing", severity: "warning", message: `${gap} of ${f.doctors.scheduled} scheduled doctors absent` });
    }
  }

  for (const t of f.diagnostics) {
    if (!t.available || t.kitsRemaining === 0) {
      signals.push({ domain: "diagnostics", severity: "critical", ref: t.id, message: `${t.name}: test unavailable` });
    } else if (t.dailyUsage > 0 && t.kitsRemaining / t.dailyUsage < THRESHOLDS.diagnosticKitDaysWarning) {
      signals.push({ domain: "diagnostics", severity: "warning", ref: t.id, message: `${t.name}: ${t.kitsRemaining} kits left` });
    }
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
    footfallToday: f.footfall.at(-1) ?? null,
    footfallAverage7d: movingAverage(f.footfall),
  };
}

export function formatDays(days: number): string {
  if (!Number.isFinite(days)) return "unlimited";
  return `${days.toFixed(1)} days`;
}
