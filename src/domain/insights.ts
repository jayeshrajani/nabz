import type { DistrictView } from "./district";
import { forecastStock } from "./forecast";
import { movingAverage } from "./risk";
import type { Severity } from "./risk";

/** Derived, read-only views for dashboards. Pure and deterministic. */

export interface RunOut {
  facilityId: string;
  facilityName: string;
  medicineId: string;
  medicineName: string;
  unit: string;
  quantity: number;
  daysLeft: number;
  leadTimeDays: number;
  severity: Exclude<Severity, "healthy">;
  suggestedOrder: number;
  /** Units another centre could send right now, if a donor exists. */
  transferQuantity: number | null;
}

/** Medicines forecast to run out within two restock cycles, soonest first. */
export function stockOutWatch(view: DistrictView): RunOut[] {
  const transfer = new Map(view.suggestions.map((s) => [`${s.toFacilityId}:${s.medicineId}`, s.quantity]));
  const out: RunOut[] = [];
  for (const { facility } of view.facilities) {
    for (const m of facility.medicines) {
      const f = forecastStock(m);
      const days = f.daysUntilStockOut;
      if (days === null || !Number.isFinite(days) || days >= m.leadTimeDays * 2) continue;
      out.push({
        facilityId: facility.id,
        facilityName: facility.name,
        medicineId: m.id,
        medicineName: m.name,
        unit: m.unit,
        quantity: m.quantity - m.reserved,
        daysLeft: days,
        leadTimeDays: m.leadTimeDays,
        severity: days < m.leadTimeDays ? "critical" : "warning",
        suggestedOrder: f.suggestedOrder,
        transferQuantity: transfer.get(`${facility.id}:${m.id}`) ?? null,
      });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.facilityName.localeCompare(b.facilityName));
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Percentage change of the last `window` days against the `window` before; null when not computable. */
export function periodChange(series: readonly number[], window = 7): number | null {
  if (series.length < window * 2) return null;
  const recent = sum(series.slice(-window));
  const previous = sum(series.slice(-window * 2, -window));
  if (previous === 0) return null;
  return Math.round(((recent - previous) / previous) * 1000) / 10;
}

/** Trailing moving average aligned to each day (null until enough history). */
export function rollingAverage(series: readonly number[], window = 7): (number | null)[] {
  return series.map((_, i) => (i + 1 < window ? null : Math.round((sum(series.slice(i + 1 - window, i + 1)) / window) * 10) / 10));
}

export interface ConsumptionTrend {
  medicineId: string;
  medicineName: string;
  unit: string;
  /** District-wide daily use, oldest first. */
  series: number[];
  lastWeek: number;
  change: number | null;
}

export function consumptionTrends(view: DistrictView): ConsumptionTrend[] {
  const byMedicine = new Map<string, ConsumptionTrend>();
  for (const { facility } of view.facilities) {
    for (const m of facility.medicines) {
      let entry = byMedicine.get(m.id);
      if (!entry) {
        entry = { medicineId: m.id, medicineName: m.name, unit: m.unit, series: [], lastWeek: 0, change: null };
        byMedicine.set(m.id, entry);
      }
      const offset = Math.max(0, m.dailyConsumption.length - entry.series.length);
      if (offset > 0) entry.series = [...new Array<number>(offset).fill(0), ...entry.series];
      const start = entry.series.length - m.dailyConsumption.length;
      m.dailyConsumption.forEach((v, i) => (entry!.series[start + i]! += v));
    }
  }
  return [...byMedicine.values()]
    .map((e) => ({ ...e, lastWeek: sum(e.series.slice(-7)), change: periodChange(e.series) }))
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));
}

export interface CentreRow {
  facilityId: string;
  name: string;
  type: "PHC" | "CHC";
  block: string;
  status: Severity;
  patientsToday: number | null;
  usualPatients: number | null;
  patientChange: number | null;
  footfall: number[];
  bedsFree: number;
  bedsTotal: number;
  doctorsPresent: number;
  doctorsRostered: number;
  medicinesAtRisk: number;
  testsDown: number;
  signals: number;
}

export function centreRows(view: DistrictView): CentreRow[] {
  return view.facilities.map(({ facility: f, assessment: a }) => {
    const usual = movingAverage(f.footfall.slice(0, -1));
    const today = a.footfallToday;
    return {
      facilityId: f.id,
      name: f.name,
      type: f.type,
      block: f.block,
      status: a.status,
      patientsToday: today,
      usualPatients: usual === null ? null : Math.round(usual),
      patientChange: today !== null && usual ? Math.round(((today - usual) / usual) * 100) : null,
      footfall: f.footfall,
      bedsFree: f.beds.total - f.beds.occupied,
      bedsTotal: f.beds.total,
      doctorsPresent: f.doctors.present,
      doctorsRostered: f.doctors.scheduled,
      medicinesAtRisk: a.signals.filter((s) => s.domain === "medicine").length,
      testsDown: f.diagnostics.filter((t) => !t.available || t.kitsRemaining === 0).length,
      signals: a.signals.length,
    };
  });
}
