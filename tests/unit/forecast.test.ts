import { describe, expect, it } from "vitest";
import { footfallOutlook, forecastSeries, forecastStock, slope, standardDeviation } from "@/domain/forecast";
import type { MedicineStock } from "@/domain/schemas";

const med = (overrides: Partial<MedicineStock> = {}): MedicineStock => ({
  id: "ors",
  name: "ORS",
  unit: "sachets",
  essential: true,
  quantity: 100,
  reserved: 0,
  reorderLevel: 20,
  leadTimeDays: 5,
  dailyConsumption: Array(14).fill(10),
  ...overrides,
});

describe("statistics helpers", () => {
  it("computes sample standard deviation", () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(standardDeviation([5])).toBe(0);
  });
  it("computes least-squares slope", () => {
    expect(slope([1, 2, 3, 4])).toBeCloseTo(1);
    expect(slope([5, 5, 5])).toBe(0);
  });
});

describe("forecastSeries", () => {
  it("is null with insufficient history", () => {
    expect(forecastSeries([1, 2])).toBeNull();
  });

  it("is flat with zero spread for constant history", () => {
    const f = forecastSeries(Array(14).fill(20))!;
    expect(f.points).toHaveLength(7);
    for (const p of f.points) expect(p).toMatchObject({ expected: 20, low: 20, high: 20 });
  });

  it("follows a damped upward trend and never predicts negatives", () => {
    const up = forecastSeries(Array.from({ length: 14 }, (_, i) => 10 + i))!;
    expect(up.trendPerDay).toBeCloseTo(0.5);
    expect(up.points[6]!.expected).toBeGreaterThan(up.points[0]!.expected);

    const down = forecastSeries(Array.from({ length: 14 }, (_, i) => 13 - i))!;
    for (const p of down.points) expect(p.low).toBeGreaterThanOrEqual(0);
  });

  it("is reproducible", () => {
    const h = [5, 9, 3, 12, 7, 8, 6, 11, 4, 10];
    expect(forecastSeries(h)).toEqual(forecastSeries(h));
  });
});

describe("forecastStock", () => {
  it("projects stock-out from steady demand", () => {
    const f = forecastStock(med());
    expect(f.daysUntilStockOut).toBe(10);
    expect(f.safetyStock).toBe(0);
    expect(f.reorderPoint).toBe(50);
    expect(f.shouldReorder).toBe(false);
  });

  it("recommends reordering below the reorder point with an order that covers lead time plus two weeks", () => {
    const f = forecastStock(med({ quantity: 30 }));
    expect(f.shouldReorder).toBe(true);
    expect(f.suggestedOrder).toBe(10 * (5 + 14) - 30);
  });

  it("adds safety stock when demand varies, and the pessimistic stock-out comes sooner", () => {
    const f = forecastStock(med({ dailyConsumption: [4, 16, 4, 16, 4, 16, 4, 16, 4, 16, 4, 16, 4, 16] }));
    expect(f.safetyStock).toBeGreaterThan(0);
    expect(f.daysUntilStockOutPessimistic!).toBeLessThan(f.daysUntilStockOut!);
  });

  it("handles zero consumption, empty stock and missing history", () => {
    expect(forecastStock(med({ dailyConsumption: Array(7).fill(0) })).daysUntilStockOut).toBe(Number.POSITIVE_INFINITY);
    expect(forecastStock(med({ quantity: 0 })).daysUntilStockOut).toBe(0);
    expect(forecastStock(med({ dailyConsumption: [3] })).daysUntilStockOut).toBeNull();
  });

  it("stays finite for extreme values", () => {
    const f = forecastStock(med({ quantity: 1_000_000, dailyConsumption: Array(7).fill(1_000_000) }));
    expect(f.daysUntilStockOut).toBe(1);
  });
});

describe("footfallOutlook", () => {
  it("flags a surge against the usual level excluding today", () => {
    const o = footfallOutlook([...Array(10).fill(50), 80]);
    expect(o.usual).toBe(50);
    expect(o.surge).toBe(true);
    expect(footfallOutlook([...Array(10).fill(50), 60]).surge).toBe(false);
  });
});
