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
      signal: { domain: "medicine", severity: "warning", ref: m.id, message: `${m.name}: not enough usage history yet` },
    };
  }
  if (m.quantity === 0 || cover < m.leadTimeDays) {
    return {
      coverage,
      signal: {
        domain: "medicine",
        severity: "critical",
        ref: m.id,
        message:
          m.quantity === 0
            ? `${m.name} is out of stock`
            : `${m.name} may run out in ${formatDays(cover)}, restock takes ${m.leadTimeDays} days`,
      },
    };
  }
  if (m.quantity <= m.reorderLevel || cover < m.leadTimeDays * THRESHOLDS.coverWarningFactor) {
    return {
      coverage,
      signal: { domain: "medicine", severity: "warning", ref: m.id, message: `${m.name} is running low, about ${formatDays(cover)} left` },
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
      signals.push({ domain: "beds", severity: "critical", message: free === 0 ? "No beds free" : `Beds nearly full, ${free} of ${f.beds.total} free` });
    } else if (bedOccupancy >= THRESHOLDS.bedOccupancyWarning) {
      signals.push({ domain: "beds", severity: "warning", message: `Beds filling up, ${free} of ${f.beds.total} free` });
    }
  }

  const attendanceRate = f.doctors.scheduled > 0 ? f.doctors.present / f.doctors.scheduled : null;
  if (attendanceRate !== null) {
    const gap = f.doctors.scheduled - f.doctors.present;
    if (attendanceRate < THRESHOLDS.attendanceCritical) {
      signals.push({ domain: "staffing", severity: "critical", message: `${gap} of ${f.doctors.scheduled} doctors absent today` });
    } else if (attendanceRate < THRESHOLDS.attendanceWarning) {
      signals.push({ domain: "staffing", severity: "warning", message: `${gap} of ${f.doctors.scheduled} doctors absent today` });
    }
  }

  for (const t of f.diagnostics) {
    if (!t.available || t.kitsRemaining === 0) {
      signals.push({ domain: "diagnostics", severity: "critical", ref: t.id, message: `${t.name} test unavailable` });
    } else if (t.dailyUsage > 0 && t.kitsRemaining / t.dailyUsage < THRESHOLDS.diagnosticKitDaysWarning) {
      signals.push({ domain: "diagnostics", severity: "warning", ref: t.id, message: `${t.name} kits running low` });
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
  if (!Number.isFinite(days)) return "no recent use";
  if (days < 1) return "under a day";
  const rounded = Math.round(days);
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}
