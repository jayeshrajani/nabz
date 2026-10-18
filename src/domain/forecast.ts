import { THRESHOLDS, movingAverage } from "./risk";
import type { MedicineStock } from "./schemas";

/**
 * Explainable baseline forecasting. No ML, no randomness: identical history gives identical output.
 */

export const FORECAST = {
  horizonDays: 7,
  trendWindow: 14,
  /** Halves the fitted slope so short-term noise does not dominate. */
  trendDamping: 0.5,
  /** ~80% two-sided band under a normal approximation. */
  rangeZ: 1.28,
  /** ~95% one-sided service level for safety stock. */
  safetyZ: 1.65,
  /** Days of demand a reorder should cover after it arrives. */
  orderCoverDays: 14,
} as const;

export interface ForecastPoint {
  day: number;
  expected: number;
  low: number;
  high: number;
}

export interface SeriesForecast {
  level: number;
  trendPerDay: number;
  spread: number;
  points: ForecastPoint[];
}

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

/** Ordinary least-squares slope over the index. */
export function slope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

export function forecastSeries(history: readonly number[], horizon: number = FORECAST.horizonDays): SeriesForecast | null {
  const level = movingAverage(history);
  if (level === null) return null;
  const recent = history.slice(-FORECAST.trendWindow);
  const trendPerDay = slope(recent) * FORECAST.trendDamping;
  const spread = standardDeviation(recent);
  const points = Array.from({ length: horizon }, (_, i) => {
    const day = i + 1;
    const expected = Math.max(0, level + trendPerDay * day);
    return {
      day,
      expected: round1(expected),
      low: round1(Math.max(0, expected - FORECAST.rangeZ * spread)),
      high: round1(expected + FORECAST.rangeZ * spread),
    };
  });
  return { level: round1(level), trendPerDay: round1(trendPerDay), spread: round1(spread), points };
}

export interface StockForecast {
  medicineId: string;
  averageDaily: number | null;
  /** Days until stock reaches zero at forecast demand; null without history, Infinity with no demand. */
  daysUntilStockOut: number | null;
  /** Same, using the high end of the demand range (a pessimistic estimate). */
  daysUntilStockOutPessimistic: number | null;
  safetyStock: number;
  reorderPoint: number;
  shouldReorder: boolean;
  suggestedOrder: number;
}

/** Walks forecast demand day by day until stock is exhausted (bounded to one year). */
function daysUntilZero(quantity: number, level: number, trend: number): number {
  if (quantity <= 0) return 0;
  let remaining = quantity;
  for (let day = 1; day <= 365; day++) {
    const demand = Math.max(0, level + trend * day);
    if (demand >= remaining) return day - 1 + remaining / demand;
    remaining -= demand;
  }
  return Number.POSITIVE_INFINITY;
}

export function forecastStock(m: MedicineStock): StockForecast {
  const f = forecastSeries(m.dailyConsumption);
  const available = m.quantity - m.reserved;
  if (!f) {
    return {
      medicineId: m.id,
      averageDaily: null,
      daysUntilStockOut: null,
      daysUntilStockOutPessimistic: null,
      safetyStock: 0,
      reorderPoint: m.reorderLevel,
      shouldReorder: available <= m.reorderLevel,
      suggestedOrder: 0,
    };
  }
  const safetyStock = Math.ceil(FORECAST.safetyZ * f.spread * Math.sqrt(m.leadTimeDays));
  const reorderPoint = Math.ceil(f.level * m.leadTimeDays + safetyStock);
  const target = f.level * (m.leadTimeDays + FORECAST.orderCoverDays) + safetyStock;
  return {
    medicineId: m.id,
    averageDaily: f.level,
    daysUntilStockOut:
      f.level <= 0 && f.trendPerDay <= 0 ? Number.POSITIVE_INFINITY : round1(daysUntilZero(available, f.level, f.trendPerDay)),
    daysUntilStockOutPessimistic: round1(daysUntilZero(available, f.level + FORECAST.rangeZ * f.spread, f.trendPerDay)),
    safetyStock,
    reorderPoint,
    shouldReorder: available <= reorderPoint,
    suggestedOrder: Math.max(0, Math.ceil(target - available)),
  };
}

export interface FootfallOutlook {
  forecast: SeriesForecast | null;
  today: number | null;
  usual: number | null;
  surge: boolean;
}

export function footfallOutlook(history: readonly number[]): FootfallOutlook {
  const today = history.at(-1) ?? null;
  // "Usual" excludes today so a surge does not inflate its own baseline.
  const usual = movingAverage(history.slice(0, -1), THRESHOLDS.movingAverageWindow);
  return {
    forecast: forecastSeries(history),
    today,
    usual: usual === null ? null : round1(usual),
    surge: today !== null && usual !== null && usual > 0 && today >= usual * THRESHOLDS.footfallSurgeRatio,
  };
}

function round1(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : v;
}
