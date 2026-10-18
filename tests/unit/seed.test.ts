import { describe, expect, it } from "vitest";
import { buildDistrictView } from "@/domain/district";
import { FacilitySchema } from "@/domain/schemas";
import { buildSeedDistrict, buildSeedFacilities, SEED_HISTORY_DAYS } from "@/domain/seed";

const AT = "2026-10-18T00:00:00.000Z";

describe("seed template", () => {
  const facilities = buildSeedFacilities(AT);

  it("is deterministic", () => {
    expect(buildSeedFacilities(AT)).toEqual(facilities);
  });

  it("produces 12 schema-valid facilities with 30 days of history", () => {
    expect(facilities).toHaveLength(12);
    for (const f of facilities) {
      expect(() => FacilitySchema.parse(f)).not.toThrow();
      expect(f.footfall).toHaveLength(SEED_HISTORY_DAYS);
      for (const m of f.medicines) expect(m.dailyConsumption).toHaveLength(SEED_HISTORY_DAYS);
    }
  });

  it("only links to facilities that exist", () => {
    const ids = new Set(facilities.map((f) => f.id));
    for (const f of facilities) for (const link of f.links) expect(ids.has(link)).toBe(true);
  });

  it("contains healthy, warning and critical facilities plus each risk domain", () => {
    const view = buildDistrictView(buildSeedDistrict("2026-10-18"), facilities);
    const statuses = new Set(view.facilities.map((f) => f.assessment.status));
    expect(statuses).toEqual(new Set(["healthy", "warning", "critical"]));
    const domains = new Set(view.facilities.flatMap((f) => f.assessment.signals.map((s) => s.domain)));
    expect(domains).toEqual(new Set(["medicine", "beds", "staffing", "diagnostics"]));
  });

  it("aggregates the district summary consistently", () => {
    const { summary } = buildDistrictView(buildSeedDistrict("2026-10-18"), facilities);
    expect(summary.facilities).toBe(12);
    expect(summary.bedsOccupied).toBeLessThanOrEqual(summary.bedsTotal);
    expect(summary.bedsTotal).toBe(facilities.reduce((s, f) => s + f.beds.total, 0));
    expect(summary.lastUpdated).toBe(AT);
  });
});
