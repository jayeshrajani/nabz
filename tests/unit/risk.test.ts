import { describe, expect, it } from "vitest";
import { assessFacility, assessMedicine, daysOfCover, movingAverage } from "@/domain/risk";
import type { Facility, MedicineStock } from "@/domain/schemas";

const medicine = (overrides: Partial<MedicineStock> = {}): MedicineStock => ({
  id: "ors-sachet",
  name: "ORS",
  unit: "sachets",
  essential: true,
  quantity: 400,
  reserved: 0,
  reorderLevel: 100,
  leadTimeDays: 5,
  dailyConsumption: [10, 10, 10, 10, 10, 10, 10],
  ...overrides,
});

const facility = (overrides: Partial<Facility> = {}): Facility => ({
  id: "phc-test",
  name: "PHC Test",
  type: "PHC",
  block: "Test Block",
  position: { x: 0, z: 0 },
  links: [],
  beds: { total: 10, occupied: 5 },
  doctors: { scheduled: 4, present: 4 },
  footfall: [50, 60, 70],
  medicines: [medicine()],
  diagnostics: [{ id: "malaria-rdt", name: "Malaria RDT", available: true, kitsRemaining: 100, dailyUsage: 5 }],
  updatedAt: "2026-10-18T00:00:00.000Z",
  ...overrides,
});

describe("movingAverage", () => {
  it("averages only the trailing window", () => {
    expect(movingAverage([100, 100, 1, 2, 3, 4, 5, 6, 7], 7)).toBe(4);
  });
  it("returns null with insufficient history", () => {
    expect(movingAverage([5, 5])).toBeNull();
    expect(movingAverage([])).toBeNull();
  });
});

describe("daysOfCover", () => {
  it("divides stock by average daily use", () => {
    expect(daysOfCover(100, 20)).toBe(5);
  });
  it("is infinite for zero consumption", () => {
    expect(daysOfCover(100, 0)).toBe(Number.POSITIVE_INFINITY);
  });
  it("is null without history", () => {
    expect(daysOfCover(100, null)).toBeNull();
  });
});

describe("assessMedicine", () => {
  it("is critical when cover is shorter than the lead time", () => {
    const { signal, coverage } = assessMedicine(medicine({ quantity: 30 }));
    expect(coverage.daysOfCover).toBe(3);
    expect(signal?.severity).toBe("critical");
  });
  it("is critical when stock is zero even with zero consumption", () => {
    expect(assessMedicine(medicine({ quantity: 0, dailyConsumption: [0, 0, 0] })).signal?.severity).toBe("critical");
  });
  it("warns at the reorder level", () => {
    expect(assessMedicine(medicine({ quantity: 100, reorderLevel: 100, dailyConsumption: [1, 1, 1] })).signal?.severity).toBe("warning");
  });
  it("warns when history is insufficient instead of guessing", () => {
    const { signal, coverage } = assessMedicine(medicine({ dailyConsumption: [10] }));
    expect(coverage.daysOfCover).toBeNull();
    expect(signal?.severity).toBe("warning");
  });
  it("is healthy with ample cover", () => {
    expect(assessMedicine(medicine({ quantity: 1000 })).signal).toBeNull();
  });
  it("handles extreme values without overflow", () => {
    const { coverage } = assessMedicine(medicine({ quantity: Number.MAX_SAFE_INTEGER, dailyConsumption: [1e9, 1e9, 1e9] }));
    expect(Number.isFinite(coverage.daysOfCover)).toBe(true);
  });
});

describe("assessFacility", () => {
  it("is healthy when no thresholds are breached", () => {
    expect(assessFacility(facility()).status).toBe("healthy");
  });
  it("flags bed capacity", () => {
    expect(assessFacility(facility({ beds: { total: 10, occupied: 9 } })).status).toBe("warning");
    expect(assessFacility(facility({ beds: { total: 10, occupied: 10 } })).status).toBe("critical");
  });
  it("flags doctor absence", () => {
    const a = assessFacility(facility({ doctors: { scheduled: 4, present: 1 } }));
    expect(a.status).toBe("critical");
    expect(a.signals[0]?.domain).toBe("staffing");
  });
  it("flags unavailable diagnostics", () => {
    const a = assessFacility(facility({ diagnostics: [{ id: "x", name: "X", available: false, kitsRemaining: 0, dailyUsage: 1 }] }));
    expect(a.signals.some((s) => s.domain === "diagnostics" && s.severity === "critical")).toBe(true);
  });
  it("orders critical signals first and reports the worst status", () => {
    const a = assessFacility(facility({ beds: { total: 10, occupied: 9 }, medicines: [medicine({ quantity: 10 })] }));
    expect(a.status).toBe("critical");
    expect(a.signals.map((s) => s.severity)).toEqual(["critical", "warning"]);
  });
  it("tolerates zero beds and zero scheduled doctors", () => {
    const a = assessFacility(facility({ beds: { total: 0, occupied: 0 }, doctors: { scheduled: 0, present: 0 } }));
    expect(a.bedOccupancy).toBeNull();
    expect(a.attendanceRate).toBeNull();
  });
});
