import { z } from "zod";

export const MAX_HISTORY_DAYS = 90;
export const MAX_FACILITIES_PER_DISTRICT = 50;

const id = z.string().regex(/^[a-z0-9-]{1,64}$/);
const count = z.number().int().nonnegative();

export const FacilityTypeSchema = z.enum(["PHC", "CHC"]);

export const MedicineStockSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(32),
  essential: z.boolean(),
  quantity: count,
  /** Units held for approved outgoing transfers; always <= quantity. */
  reserved: count.default(0),
  reorderLevel: count,
  leadTimeDays: z.number().int().min(1).max(60),
  /** Units consumed per day, oldest first. */
  dailyConsumption: z.array(count).max(MAX_HISTORY_DAYS),
}).refine((m) => m.reserved <= m.quantity, { message: "reserved stock cannot exceed quantity" });

export const DiagnosticTestSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  available: z.boolean(),
  kitsRemaining: count,
  dailyUsage: z.number().nonnegative(),
});

export const BedStatusSchema = z
  .object({ total: count, occupied: count })
  .refine((b) => b.occupied <= b.total, { message: "occupied beds cannot exceed total beds" });

export const StaffingSchema = z
  .object({ scheduled: count, present: count })
  .refine((s) => s.present <= s.scheduled, { message: "present doctors cannot exceed scheduled" });

export const FacilitySchema = z.object({
  id,
  name: z.string().min(1).max(120),
  type: FacilityTypeSchema,
  block: z.string().min(1).max(80),
  /** Stylised network coordinates, not geographic positions. */
  position: z.object({ x: z.number().min(-50).max(50), z: z.number().min(-50).max(50) }),
  links: z.array(id).max(12),
  beds: BedStatusSchema,
  doctors: StaffingSchema,
  /** Patient arrivals per day, oldest first. */
  footfall: z.array(count).max(MAX_HISTORY_DAYS),
  medicines: z.array(MedicineStockSchema).max(50),
  diagnostics: z.array(DiagnosticTestSchema).max(30),
  updatedAt: z.iso.datetime(),
});

export const DistrictSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  synthetic: z.literal(true),
  historyEndDate: z.iso.date(),
});

export type FacilityType = z.infer<typeof FacilityTypeSchema>;
export type MedicineStock = z.infer<typeof MedicineStockSchema>;
export type DiagnosticTest = z.infer<typeof DiagnosticTestSchema>;
export type Facility = z.infer<typeof FacilitySchema>;
export type District = z.infer<typeof DistrictSchema>;
