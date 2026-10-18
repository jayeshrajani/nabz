import { describe, expect, it } from "vitest";
import { buildSeedFacilities } from "@/domain/seed";
import { createMemoryRepository } from "@/lib/data/repository";
import { AppError } from "@/lib/errors/app-error";

const FACILITY = "phc-nazirabad";

async function setup() {
  const repo = createMemoryRepository();
  await repo.ensureSession("s1");
  await repo.ensureSession("s2");
  return repo;
}

const stockOf = async (repo: Awaited<ReturnType<typeof setup>>, session: string, medicineId: string) =>
  (await repo.getFacility(session, FACILITY))!.facility.medicines.find((m) => m.id === medicineId)!.quantity;

describe("memory repository updates", () => {
  const medicine = buildSeedFacilities(new Date().toISOString()).find((f) => f.id === FACILITY)!.medicines[0]!;

  it("applies an update and logs it to activity", async () => {
    const repo = await setup();
    const out = await repo.applyUpdate("s1", { facilityId: FACILITY, actorUid: "u", update: { kind: "beds", occupied: 1, total: 6 } });
    expect(out.replayed).toBe(false);
    const record = await repo.getFacility("s1", FACILITY);
    expect(record!.facility.beds.occupied).toBe(1);
    expect(record!.activity[0]!.id).toBe(out.audit.id);
  });

  it("keeps sessions isolated", async () => {
    const repo = await setup();
    await repo.applyUpdate("s1", { facilityId: FACILITY, actorUid: "u", update: { kind: "stock", medicineId: medicine.id, movement: "receive", quantity: 100 } });
    expect(await stockOf(repo, "s2", medicine.id)).toBe(medicine.quantity);
  });

  it("replays duplicate requests with the same idempotency key instead of double-applying", async () => {
    const repo = await setup();
    const command = {
      facilityId: FACILITY,
      actorUid: "u",
      idempotencyKey: "key-12345678",
      update: { kind: "stock" as const, medicineId: medicine.id, movement: "receive" as const, quantity: 40 },
    };
    const first = await repo.applyUpdate("s1", command);
    const second = await repo.applyUpdate("s1", command);
    expect(second.replayed).toBe(true);
    expect(second.audit.id).toBe(first.audit.id);
    expect(await stockOf(repo, "s1", medicine.id)).toBe(medicine.quantity + 40);
  });

  it("rejects reuse of an idempotency key for a different request", async () => {
    const repo = await setup();
    await repo.applyUpdate("s1", { facilityId: FACILITY, actorUid: "u", idempotencyKey: "key-abcdefgh", update: { kind: "footfall", today: 5 } });
    await expect(
      repo.applyUpdate("s1", { facilityId: FACILITY, actorUid: "u", idempotencyKey: "key-abcdefgh", update: { kind: "beds", occupied: 1, total: 6 } }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("serialises concurrent issues so stock never goes negative", async () => {
    const repo = await setup();
    const quantity = Math.ceil(medicine.quantity / 3);
    const attempts = Array.from({ length: 6 }, () =>
      repo.applyUpdate("s1", { facilityId: FACILITY, actorUid: "u", update: { kind: "stock", medicineId: medicine.id, movement: "issue", quantity } }),
    );
    const results = await Promise.allSettled(attempts);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    expect(succeeded).toBe(Math.floor(medicine.quantity / quantity));
    expect(await stockOf(repo, "s1", medicine.id)).toBe(medicine.quantity - succeeded * quantity);
    expect(await stockOf(repo, "s1", medicine.id)).toBeGreaterThanOrEqual(0);
  });

  it("returns NOT_FOUND for unknown centres", async () => {
    const repo = await setup();
    await expect(repo.applyUpdate("s1", { facilityId: "nope", actorUid: "u", update: { kind: "footfall", today: 1 } })).rejects.toBeInstanceOf(AppError);
  });
});
