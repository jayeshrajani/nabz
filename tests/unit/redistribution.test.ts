import { describe, expect, it } from "vitest";
import { DomainRuleError } from "@/domain/operations";
import { applyTransferAction, createTransfer, donorReserve, suggestTransfers, transferableSurplus } from "@/domain/redistribution";
import { buildSeedFacilities } from "@/domain/seed";
import { createMemoryRepository } from "@/lib/data/repository";

const AT = "2026-10-18T00:00:00.000Z";
const ctx = { actorUid: "u1", at: AT };
const seed = () => buildSeedFacilities(AT);

describe("suggestTransfers", () => {
  const facilities = seed();
  const suggestions = suggestTransfers(facilities, []);

  it("finds donors for centres that will run out before restock", () => {
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.fromFacilityId).not.toBe(s.toFacilityId);
      expect(s.receiver.daysLeftBefore!).toBeLessThan(s.receiver.leadTimeDays);
      expect(s.quantity).toBeGreaterThan(0);
    }
  });

  it("never asks a donor to dip below its own reserve", () => {
    for (const s of suggestions) {
      const donor = facilities.find((f) => f.id === s.fromFacilityId)!.medicines.find((m) => m.id === s.medicineId)!;
      expect(s.quantity).toBeLessThanOrEqual(transferableSurplus(donor));
      expect(donor.quantity - s.quantity).toBeGreaterThanOrEqual(donorReserve(donor));
    }
  });

  it("is deterministic", () => {
    expect(suggestTransfers(facilities, [])).toEqual(suggestions);
  });
});

describe("transfer lifecycle", () => {
  const facilities = seed();
  const s = suggestTransfers(facilities, [])[0]!;
  const donor = facilities.find((f) => f.id === s.fromFacilityId)!;
  const receiver = facilities.find((f) => f.id === s.toFacilityId)!;
  const stock = (f: typeof donor) => f.medicines.find((m) => m.id === s.medicineId)!;
  const request = { fromFacilityId: s.fromFacilityId, toFacilityId: s.toFacilityId, medicineId: s.medicineId, quantity: s.quantity };

  it("reserves on approve, removes on dispatch, adds only on receipt", () => {
    const t0 = createTransfer(request, donor, receiver, { ...ctx, id: "transfer-0001" });
    expect(t0.status).toBe("proposed");

    const a = applyTransferAction(t0, donor, receiver, "approve", ctx);
    expect(stock(a.donor).reserved).toBe(s.quantity);
    expect(stock(a.donor).quantity).toBe(stock(donor).quantity);

    const d = applyTransferAction(a.transfer, a.donor, receiver, "dispatch", ctx);
    expect(stock(d.donor).quantity).toBe(stock(donor).quantity - s.quantity);
    expect(stock(d.donor).reserved).toBe(0);
    expect(stock(d.receiver).quantity).toBe(stock(receiver).quantity);

    const r = applyTransferAction(d.transfer, d.donor, d.receiver, "receive", ctx);
    expect(r.transfer.status).toBe("received");
    expect(stock(r.receiver).quantity).toBe(stock(receiver).quantity + s.quantity);
  });

  it("rejects invalid transitions and over-surplus requests", () => {
    const t0 = createTransfer(request, donor, receiver, { ...ctx, id: "transfer-0002" });
    expect(() => applyTransferAction(t0, donor, receiver, "receive", ctx)).toThrow(DomainRuleError);
    expect(() => createTransfer({ ...request, quantity: stock(donor).quantity }, donor, receiver, { ...ctx, id: "transfer-0003" })).toThrow(
      DomainRuleError,
    );
    expect(() => createTransfer({ ...request, toFacilityId: donor.id }, donor, donor, { ...ctx, id: "transfer-0004" })).toThrow(
      DomainRuleError,
    );
  });

  it("releases the reservation on cancel after approval", () => {
    const t0 = createTransfer(request, donor, receiver, { ...ctx, id: "transfer-0005" });
    const a = applyTransferAction(t0, donor, receiver, "approve", ctx);
    const c = applyTransferAction(a.transfer, a.donor, receiver, "cancel", ctx);
    expect(c.transfer.status).toBe("cancelled");
    expect(stock(c.donor).reserved).toBe(0);
  });
});

describe("repository transfers", () => {
  it("runs end to end, replays duplicates, and stops double approvals beyond surplus", async () => {
    const repo = createMemoryRepository();
    await repo.ensureSession("s1");
    const snap = (await repo.getSnapshot("s1"))!;
    const s = suggestTransfers(snap.facilities, [])[0]!;
    const request = { fromFacilityId: s.fromFacilityId, toFacilityId: s.toFacilityId, medicineId: s.medicineId, quantity: s.quantity };

    const created = await repo.createTransfer("s1", { request, actorUid: "u", idempotencyKey: "create-key-1" });
    const replay = await repo.createTransfer("s1", { request, actorUid: "u", idempotencyKey: "create-key-1" });
    expect(replay.replayed).toBe(true);
    expect(replay.transfer.id).toBe(created.transfer.id);
    expect((await repo.getSnapshot("s1"))!.transfers).toHaveLength(1);

    const second = await repo.createTransfer("s1", { request, actorUid: "u" });
    await repo.advanceTransfer("s1", { transferId: created.transfer.id, action: "approve", actorUid: "u" });
    const surplusLeft = transferableSurplus(
      (await repo.getSnapshot("s1"))!.facilities.find((f) => f.id === s.fromFacilityId)!.medicines.find((m) => m.id === s.medicineId)!,
    );
    if (surplusLeft < s.quantity) {
      await expect(repo.advanceTransfer("s1", { transferId: second.transfer.id, action: "approve", actorUid: "u" })).rejects.toBeInstanceOf(
        DomainRuleError,
      );
    }

    await repo.advanceTransfer("s1", { transferId: created.transfer.id, action: "dispatch", actorUid: "u" });
    const done = await repo.advanceTransfer("s1", { transferId: created.transfer.id, action: "receive", actorUid: "u" });
    expect(done.transfer.status).toBe("received");

    const other = await repo.ensureSession("s2");
    expect(other.created).toBe(true);
    expect((await repo.getSnapshot("s2"))!.transfers).toHaveLength(0);
  });
});
