import { z } from "zod";
import { FacilitySchema, MAX_HISTORY_DAYS, type Facility } from "./schemas";

const count = z.number().int().nonnegative().max(1_000_000);
const ref = z.string().regex(/^[a-z0-9-]{1,64}$/);

export const FacilityUpdateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("beds"), occupied: count, total: count }),
  z.object({ kind: z.literal("attendance"), present: count, scheduled: count }),
  z.object({ kind: z.literal("footfall"), today: count }),
  z.object({
    kind: z.literal("stock"),
    medicineId: ref,
    movement: z.enum(["receive", "issue", "count"]),
    quantity: count,
    note: z.string().trim().max(200).optional(),
  }),
  z.object({ kind: z.literal("diagnostic"), testId: ref, available: z.boolean(), kitsRemaining: count }),
]);

export type FacilityUpdate = z.infer<typeof FacilityUpdateSchema>;

export interface InventoryMovement {
  id: string;
  facilityId: string;
  medicineId: string;
  movement: "receive" | "issue" | "count";
  /** Signed change applied to stock. */
  delta: number;
  balanceAfter: number;
  note?: string;
  actorUid: string;
  at: string;
}

export interface AuditEvent {
  id: string;
  facilityId: string;
  kind: FacilityUpdate["kind"] | "transfer";
  summary: string;
  actorUid: string;
  at: string;
}

export class DomainRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainRuleError";
  }
}

export interface UpdateResult {
  facility: Facility;
  audit: AuditEvent;
  movement?: InventoryMovement;
}

function bumpToday(series: number[], by: number): number[] {
  if (series.length === 0) return [by];
  const next = series.slice(-MAX_HISTORY_DAYS);
  next[next.length - 1] = (next[next.length - 1] ?? 0) + by;
  return next;
}

/** Pure state transition. Throws DomainRuleError on any invariant violation; never returns invalid state. */
export function applyFacilityUpdate(
  facility: Facility,
  update: FacilityUpdate,
  ctx: { actorUid: string; at: string; id: string },
): UpdateResult {
  const next: Facility = structuredClone(facility);
  next.updatedAt = ctx.at;
  let summary: string;
  let movement: InventoryMovement | undefined;

  switch (update.kind) {
    case "beds": {
      if (update.occupied > update.total) throw new DomainRuleError("Occupied beds cannot exceed total beds.");
      next.beds = { total: update.total, occupied: update.occupied };
      summary = `Beds set to ${update.occupied} occupied of ${update.total}`;
      break;
    }
    case "attendance": {
      if (update.present > update.scheduled) throw new DomainRuleError("Present doctors cannot exceed scheduled doctors.");
      next.doctors = { scheduled: update.scheduled, present: update.present };
      summary = `Attendance set to ${update.present} of ${update.scheduled} doctors`;
      break;
    }
    case "footfall": {
      if (next.footfall.length === 0) next.footfall = [update.today];
      else next.footfall[next.footfall.length - 1] = update.today;
      summary = `Today's patients recorded as ${update.today}`;
      break;
    }
    case "stock": {
      const medicine = next.medicines.find((m) => m.id === update.medicineId);
      if (!medicine) throw new DomainRuleError("Unknown medicine for this centre.");
      const before = medicine.quantity;
      if (update.movement === "receive") {
        if (update.quantity === 0) throw new DomainRuleError("Received quantity must be more than zero.");
        medicine.quantity = before + update.quantity;
      } else if (update.movement === "issue") {
        if (update.quantity === 0) throw new DomainRuleError("Issued quantity must be more than zero.");
        const free = before - medicine.reserved;
        if (update.quantity > free)
          throw new DomainRuleError(
            `Only ${free} ${medicine.unit} available${medicine.reserved ? ` (${medicine.reserved} held for transfers)` : ""}.`,
          );
        medicine.quantity = before - update.quantity;
        medicine.dailyConsumption = bumpToday(medicine.dailyConsumption, update.quantity);
      } else {
        if (update.quantity < medicine.reserved)
          throw new DomainRuleError(`${medicine.reserved} ${medicine.unit} are held for transfers; count cannot be lower.`);
        medicine.quantity = update.quantity;
      }
      const delta = medicine.quantity - before;
      movement = {
        id: ctx.id,
        facilityId: facility.id,
        medicineId: medicine.id,
        movement: update.movement,
        delta,
        balanceAfter: medicine.quantity,
        ...(update.note ? { note: update.note } : {}),
        actorUid: ctx.actorUid,
        at: ctx.at,
      };
      const verb = update.movement === "receive" ? "Received" : update.movement === "issue" ? "Issued" : "Counted";
      summary = `${verb} ${update.movement === "count" ? medicine.quantity : update.quantity} × ${medicine.name}`;
      break;
    }
    case "diagnostic": {
      const test = next.diagnostics.find((t) => t.id === update.testId);
      if (!test) throw new DomainRuleError("Unknown test for this centre.");
      test.available = update.available && update.kitsRemaining > 0;
      test.kitsRemaining = update.kitsRemaining;
      summary = `${test.name} marked ${test.available ? `available, ${test.kitsRemaining} kits` : "unavailable"}`;
      break;
    }
  }

  const parsed = FacilitySchema.safeParse(next);
  if (!parsed.success) throw new DomainRuleError("Update would produce an invalid record.");

  return {
    facility: parsed.data,
    movement,
    audit: { id: ctx.id, facilityId: facility.id, kind: update.kind, summary, actorUid: ctx.actorUid, at: ctx.at },
  };
}
