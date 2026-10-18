import { describe, expect, it } from "vitest";
import { buildDistrictView } from "@/domain/district";
import { centreRows, consumptionTrends, periodChange, rollingAverage, stockOutWatch } from "@/domain/insights";
import { buildSeedDistrict, buildSeedFacilities } from "@/domain/seed";

const view = buildDistrictView(buildSeedDistrict("2026-10-18"), buildSeedFacilities("2026-10-18T00:00:00.000Z"), []);

describe("stockOutWatch", () => {
  const list = stockOutWatch(view);

  it("lists medicines running out within two restock cycles, soonest first", () => {
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) expect(list[i]!.daysLeft).toBeGreaterThanOrEqual(list[i - 1]!.daysLeft);
    for (const r of list) expect(r.daysLeft).toBeLessThan(r.leadTimeDays * 2);
  });

  it("marks run-outs before restock as critical and links available transfers", () => {
    const critical = list.filter((r) => r.severity === "critical");
    expect(critical.length).toBeGreaterThan(0);
    for (const r of critical) expect(r.daysLeft).toBeLessThan(r.leadTimeDays);
    expect(list.some((r) => r.transferQuantity !== null)).toBe(true);
  });
});

describe("history helpers", () => {
  it("computes week-over-week change", () => {
    expect(periodChange([...Array(7).fill(10), ...Array(7).fill(12)])).toBe(20);
    expect(periodChange([1, 2, 3])).toBeNull();
    expect(periodChange([...Array(7).fill(0), ...Array(7).fill(5)])).toBeNull();
  });

  it("computes a trailing rolling average", () => {
    expect(rollingAverage([2, 4, 6, 8], 2)).toEqual([null, 3, 5, 7]);
  });

  it("sums medicine use across the district", () => {
    const trends = consumptionTrends(view);
    const ors = trends.find((t) => t.medicineId === "ors-sachet")!;
    const expected = view.facilities.reduce((s, { facility }) => s + facility.medicines.find((m) => m.id === "ors-sachet")!.dailyConsumption.at(-1)!, 0);
    expect(ors.series.at(-1)).toBe(expected);
    expect(ors.series).toHaveLength(30);
  });
});

describe("centreRows", () => {
  it("summarises every centre consistently", () => {
    const rows = centreRows(view);
    expect(rows).toHaveLength(12);
    for (const r of rows) {
      expect(r.bedsFree).toBeLessThanOrEqual(r.bedsTotal);
      expect(r.doctorsPresent).toBeLessThanOrEqual(r.doctorsRostered);
    }
  });
});
