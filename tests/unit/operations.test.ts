import { describe, expect, it } from "vitest";
import { applyFacilityUpdate, DomainRuleError, FacilityUpdateSchema } from "@/domain/operations";
import { buildSeedFacilities } from "@/domain/seed";

const ctx = { actorUid: "u1", at: "2026-10-18T10:00:00.000Z", id: "evt-1" };
const base = () => buildSeedFacilities("2026-10-18T00:00:00.000Z")[3]!;

describe("applyFacilityUpdate", () => {
  it("receives stock and records a positive movement", () => {
    const f = base();
    const m = f.medicines[0]!;
    const r = applyFacilityUpdate(f, { kind: "stock", medicineId: m.id, movement: "receive", quantity: 50 }, ctx);
    expect(r.facility.medicines[0]!.quantity).toBe(m.quantity + 50);
    expect(r.movement).toMatchObject({ delta: 50, balanceAfter: m.quantity + 50 });
    expect(r.audit.summary).toContain("Received 50");
  });

  it("issues stock, counts it as today's consumption, and never goes negative", () => {
    const f = base();
    const m = f.medicines[0]!;
    const r = applyFacilityUpdate(f, { kind: "stock", medicineId: m.id, movement: "issue", quantity: 5 }, ctx);
    expect(r.facility.medicines[0]!.quantity).toBe(m.quantity - 5);
    expect(r.facility.medicines[0]!.dailyConsumption.at(-1)).toBe(m.dailyConsumption.at(-1)! + 5);
    expect(() => applyFacilityUpdate(f, { kind: "stock", medicineId: m.id, movement: "issue", quantity: m.quantity + 1 }, ctx)).toThrow(DomainRuleError);
  });

  it("sets an absolute count", () => {
    const f = base();
    const r = applyFacilityUpdate(f, { kind: "stock", medicineId: f.medicines[1]!.id, movement: "count", quantity: 7 }, ctx);
    expect(r.facility.medicines[1]!.quantity).toBe(7);
    expect(r.movement!.delta).toBe(7 - f.medicines[1]!.quantity);
  });

  it("rejects unknown medicines and tests", () => {
    expect(() => applyFacilityUpdate(base(), { kind: "stock", medicineId: "nope", movement: "receive", quantity: 1 }, ctx)).toThrow(DomainRuleError);
    expect(() => applyFacilityUpdate(base(), { kind: "diagnostic", testId: "nope", available: true, kitsRemaining: 1 }, ctx)).toThrow(DomainRuleError);
  });

  it("enforces bed and attendance invariants", () => {
    expect(() => applyFacilityUpdate(base(), { kind: "beds", occupied: 7, total: 6 }, ctx)).toThrow(DomainRuleError);
    expect(() => applyFacilityUpdate(base(), { kind: "attendance", present: 4, scheduled: 3 }, ctx)).toThrow(DomainRuleError);
    expect(applyFacilityUpdate(base(), { kind: "beds", occupied: 2, total: 6 }, ctx).facility.beds).toEqual({ occupied: 2, total: 6 });
  });

  it("replaces today's footfall without growing history", () => {
    const f = base();
    const r = applyFacilityUpdate(f, { kind: "footfall", today: 123 }, ctx);
    expect(r.facility.footfall).toHaveLength(f.footfall.length);
    expect(r.facility.footfall.at(-1)).toBe(123);
  });

  it("marks a test with zero kits as unavailable", () => {
    const f = base();
    const r = applyFacilityUpdate(f, { kind: "diagnostic", testId: f.diagnostics[0]!.id, available: true, kitsRemaining: 0 }, ctx);
    expect(r.facility.diagnostics[0]!.available).toBe(false);
  });

  it("does not mutate the input", () => {
    const f = base();
    const snapshot = structuredClone(f);
    applyFacilityUpdate(f, { kind: "beds", occupied: 0, total: 6 }, ctx);
    expect(f).toEqual(snapshot);
  });
});

describe("FacilityUpdateSchema", () => {
  it("rejects negative, fractional and unknown payloads", () => {
    expect(FacilityUpdateSchema.safeParse({ kind: "beds", occupied: -1, total: 5 }).success).toBe(false);
    expect(FacilityUpdateSchema.safeParse({ kind: "footfall", today: 1.5 }).success).toBe(false);
    expect(FacilityUpdateSchema.safeParse({ kind: "teleport" }).success).toBe(false);
    expect(FacilityUpdateSchema.safeParse({ kind: "stock", medicineId: "../x", movement: "receive", quantity: 1 }).success).toBe(false);
  });
});
