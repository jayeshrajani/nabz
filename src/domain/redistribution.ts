import { z } from "zod";
import { forecastStock } from "./forecast";
import { DomainRuleError } from "./operations";
import { FacilitySchema, type Facility, type MedicineStock } from "./schemas";

export const REDISTRIBUTION = {
  /** A donor always keeps enough for its own lead time plus this many days, plus safety stock. */
  donorReserveDays: 14,
  /** A receiver is topped up to cover its lead time plus this many days. */
  receiverTargetDays: 7,
  /** Network units to approximate road kilometres (synthetic map; shown as "about"). */
  kmPerUnit: 2.4,
} as const;

export const TransferStatusSchema = z.enum(["proposed", "approved", "dispatched", "received", "cancelled"]);
export const TransferActionSchema = z.enum(["approve", "dispatch", "receive", "cancel"]);
export type TransferStatus = z.infer<typeof TransferStatusSchema>;
export type TransferAction = z.infer<typeof TransferActionSchema>;

const id = z.string().regex(/^[a-z0-9-]{1,64}$/);

export const TransferRequestSchema = z.object({
  fromFacilityId: id,
  toFacilityId: id,
  medicineId: id,
  quantity: z.number().int().positive().max(1_000_000),
});
export type TransferRequest = z.infer<typeof TransferRequestSchema>;

export const TransferSchema = TransferRequestSchema.extend({
  id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  status: TransferStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  history: z.array(z.object({ status: TransferStatusSchema, at: z.iso.datetime(), actorUid: z.string().max(128) })).max(10),
});
export type Transfer = z.infer<typeof TransferSchema>;

export const ACTIVE_STATUSES: readonly TransferStatus[] = ["proposed", "approved", "dispatched"];

const TRANSITIONS: Record<TransferAction, { from: readonly TransferStatus[]; to: TransferStatus }> = {
  approve: { from: ["proposed"], to: "approved" },
  dispatch: { from: ["approved"], to: "dispatched" },
  receive: { from: ["dispatched"], to: "received" },
  cancel: { from: ["proposed", "approved"], to: "cancelled" },
};

export function canApply(status: TransferStatus, action: TransferAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

function available(m: MedicineStock): number {
  return m.quantity - m.reserved;
}

/** Units a donor must keep for itself: demand over lead time + reserve days, plus safety stock. */
export function donorReserve(m: MedicineStock): number {
  const f = forecastStock(m);
  if (f.averageDaily === null) return m.quantity; // no history: never treat as surplus
  return Math.ceil(f.averageDaily * (m.leadTimeDays + REDISTRIBUTION.donorReserveDays) + f.safetyStock);
}

export function transferableSurplus(m: MedicineStock): number {
  return Math.max(0, available(m) - donorReserve(m));
}

export function distanceKm(a: Facility, b: Facility): number {
  return Math.round(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) * REDISTRIBUTION.kmPerUnit);
}

function daysLeft(stock: number, perDay: number | null): number | null {
  if (perDay === null) return null;
  if (perDay <= 0) return Number.POSITIVE_INFINITY;
  return Math.round((stock / perDay) * 10) / 10;
}

export interface TransferSuggestion {
  id: string;
  medicineId: string;
  medicineName: string;
  unit: string;
  toFacilityId: string;
  fromFacilityId: string;
  quantity: number;
  distanceKm: number;
  coversFully: boolean;
  receiver: { daysLeftBefore: number | null; daysLeftAfter: number | null; leadTimeDays: number; shortfall: number };
  donor: { daysLeftBefore: number | null; daysLeftAfter: number | null; reserve: number; surplus: number };
  /** Other centres that could also donate, nearest first. */
  alternatives: number;
}

/**
 * For each medicine that will run out before restock can arrive, find the best donor:
 * enough surplus above its own reserve, preferring a donor that covers the full shortfall, then the nearest.
 */
export function suggestTransfers(facilities: readonly Facility[], transfers: readonly Transfer[]): TransferSuggestion[] {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const t of transfers) {
    if (!ACTIVE_STATUSES.includes(t.status)) continue;
    incoming.set(`${t.toFacilityId}:${t.medicineId}`, (incoming.get(`${t.toFacilityId}:${t.medicineId}`) ?? 0) + t.quantity);
    if (t.status === "proposed") outgoing.set(`${t.fromFacilityId}:${t.medicineId}`, (outgoing.get(`${t.fromFacilityId}:${t.medicineId}`) ?? 0) + t.quantity);
  }

  const suggestions: TransferSuggestion[] = [];
  for (const receiver of facilities) {
    for (const m of receiver.medicines) {
      const f = forecastStock(m);
      if (f.averageDaily === null || f.averageDaily <= 0) continue;
      const have = available(m) + (incoming.get(`${receiver.id}:${m.id}`) ?? 0);
      if (have / f.averageDaily >= m.leadTimeDays) continue;

      const shortfall = Math.ceil(f.averageDaily * (m.leadTimeDays + REDISTRIBUTION.receiverTargetDays)) - have;
      if (shortfall <= 0) continue;

      const donors = facilities
        .filter((d) => d.id !== receiver.id)
        .flatMap((d) => {
          const dm = d.medicines.find((x) => x.id === m.id);
          if (!dm) return [];
          const surplus = transferableSurplus(dm) - (outgoing.get(`${d.id}:${m.id}`) ?? 0);
          return surplus > 0 ? [{ facility: d, medicine: dm, surplus, km: distanceKm(receiver, d) }] : [];
        })
        .sort((a, b) => Number(b.surplus >= shortfall) - Number(a.surplus >= shortfall) || a.km - b.km || a.facility.id.localeCompare(b.facility.id));

      const best = donors[0];
      if (!best) continue;
      const quantity = Math.min(shortfall, best.surplus);
      const donorDaily = forecastStock(best.medicine).averageDaily;

      suggestions.push({
        id: `${receiver.id}--${m.id}--${best.facility.id}`,
        medicineId: m.id,
        medicineName: m.name,
        unit: m.unit,
        toFacilityId: receiver.id,
        fromFacilityId: best.facility.id,
        quantity,
        distanceKm: best.km,
        coversFully: quantity >= shortfall,
        receiver: {
          daysLeftBefore: daysLeft(have, f.averageDaily),
          daysLeftAfter: daysLeft(have + quantity, f.averageDaily),
          leadTimeDays: m.leadTimeDays,
          shortfall,
        },
        donor: {
          daysLeftBefore: daysLeft(available(best.medicine), donorDaily),
          daysLeftAfter: daysLeft(available(best.medicine) - quantity, donorDaily),
          reserve: donorReserve(best.medicine),
          surplus: best.surplus,
        },
        alternatives: donors.length - 1,
      });
    }
  }
  return suggestions.sort((a, b) => (a.receiver.daysLeftBefore ?? 0) - (b.receiver.daysLeftBefore ?? 0) || a.id.localeCompare(b.id));
}

function medicineOf(f: Facility, medicineId: string): MedicineStock {
  const m = f.medicines.find((x) => x.id === medicineId);
  if (!m) throw new DomainRuleError(`${f.name} does not stock this medicine.`);
  return m;
}

function assertWithinSurplus(donor: Facility, medicineId: string, quantity: number): void {
  const surplus = transferableSurplus(medicineOf(donor, medicineId));
  if (quantity > surplus) throw new DomainRuleError(`${donor.name} can spare at most ${surplus} without dipping into its own reserve.`);
}

export interface TransferCtx {
  id: string;
  actorUid: string;
  at: string;
}

export function createTransfer(request: TransferRequest, donor: Facility, receiver: Facility, ctx: TransferCtx): Transfer {
  if (donor.id === receiver.id) throw new DomainRuleError("A centre cannot transfer to itself.");
  medicineOf(receiver, request.medicineId);
  assertWithinSurplus(donor, request.medicineId, request.quantity);
  return TransferSchema.parse({
    ...request,
    id: ctx.id,
    status: "proposed",
    createdAt: ctx.at,
    updatedAt: ctx.at,
    history: [{ status: "proposed", at: ctx.at, actorUid: ctx.actorUid }],
  });
}

export interface TransferResult {
  transfer: Transfer;
  donor: Facility;
  receiver: Facility;
}

/**
 * Advances a transfer one step. Approval reserves donor stock, dispatch removes it from the donor,
 * receipt adds it to the receiver. Nothing is moved before the matching step is confirmed.
 */
export function applyTransferAction(transfer: Transfer, donorIn: Facility, receiverIn: Facility, action: TransferAction, ctx: Omit<TransferCtx, "id">): TransferResult {
  if (!canApply(transfer.status, action)) throw new DomainRuleError(`Cannot ${action} a transfer that is ${transfer.status}.`);
  const donor = structuredClone(donorIn);
  const receiver = structuredClone(receiverIn);
  const dm = medicineOf(donor, transfer.medicineId);
  const q = transfer.quantity;

  switch (action) {
    case "approve":
      assertWithinSurplus(donor, transfer.medicineId, q);
      dm.reserved += q;
      break;
    case "dispatch":
      if (dm.reserved < q || dm.quantity < q) throw new DomainRuleError("Reserved stock is no longer available at the donor.");
      dm.reserved -= q;
      dm.quantity -= q;
      break;
    case "receive":
      medicineOf(receiver, transfer.medicineId).quantity += q;
      break;
    case "cancel":
      if (transfer.status === "approved") dm.reserved = Math.max(0, dm.reserved - q);
      break;
  }

  const to = TRANSITIONS[action].to;
  const next: Transfer = {
    ...transfer,
    status: to,
    updatedAt: ctx.at,
    history: [...transfer.history, { status: to, at: ctx.at, actorUid: ctx.actorUid }].slice(-10),
  };
  donor.updatedAt = ctx.at;
  if (action === "receive") receiver.updatedAt = ctx.at;

  const parsedDonor = FacilitySchema.safeParse(donor);
  const parsedReceiver = FacilitySchema.safeParse(receiver);
  if (!parsedDonor.success || !parsedReceiver.success) throw new DomainRuleError("Transfer would produce an invalid stock record.");
  return { transfer: TransferSchema.parse(next), donor: parsedDonor.data, receiver: parsedReceiver.data };
}
