import type { DiagnosticTest, District, Facility, FacilityType, MedicineStock } from "./schemas";

/**
 * Deterministic synthetic district template. Same input → same output, so forecasts are
 * reproducible. All names and figures are fictional.
 */

export const SEED_HISTORY_DAYS = 30;
export const SEED_DISTRICT_ID = "vellora";

type Profile = "healthy" | "surplus" | "stockout" | "beds" | "staffing" | "diagnostics";

interface FacilitySpec {
  id: string;
  name: string;
  type: FacilityType;
  block: string;
  hub?: string;
  profile: Profile;
}

const SPECS: readonly FacilitySpec[] = [
  { id: "chc-ashwini-nagar", name: "CHC Ashwini Nagar", type: "CHC", block: "North Block", profile: "surplus" },
  { id: "chc-devgarh", name: "CHC Devgarh", type: "CHC", block: "River Block", profile: "beds" },
  { id: "chc-sonpur-ghat", name: "CHC Sonpur Ghat", type: "CHC", block: "Hill Block", profile: "healthy" },
  { id: "phc-kalapur", name: "PHC Kalapur", type: "PHC", block: "North Block", hub: "chc-ashwini-nagar", profile: "stockout" },
  { id: "phc-meghwadi", name: "PHC Meghwadi", type: "PHC", block: "North Block", hub: "chc-ashwini-nagar", profile: "healthy" },
  { id: "phc-tilakpura", name: "PHC Tilakpura", type: "PHC", block: "North Block", hub: "chc-ashwini-nagar", profile: "staffing" },
  { id: "phc-ranikhet-mod", name: "PHC Ranikhet Mod", type: "PHC", block: "River Block", hub: "chc-devgarh", profile: "diagnostics" },
  { id: "phc-baghola", name: "PHC Baghola", type: "PHC", block: "River Block", hub: "chc-devgarh", profile: "healthy" },
  { id: "phc-chandrapur", name: "PHC Chandrapur", type: "PHC", block: "River Block", hub: "chc-devgarh", profile: "stockout" },
  { id: "phc-jhilmil", name: "PHC Jhilmil", type: "PHC", block: "Hill Block", hub: "chc-sonpur-ghat", profile: "surplus" },
  { id: "phc-pahadganj", name: "PHC Pahadganj", type: "PHC", block: "Hill Block", hub: "chc-sonpur-ghat", profile: "healthy" },
  { id: "phc-neelkanth", name: "PHC Neelkanth", type: "PHC", block: "Hill Block", hub: "chc-sonpur-ghat", profile: "beds" },
];

const MEDICINES = [
  { id: "paracetamol-500", name: "Paracetamol 500 mg", unit: "tablets", base: 120, lead: 5 },
  { id: "amoxicillin-250", name: "Amoxicillin 250 mg", unit: "capsules", base: 60, lead: 7 },
  { id: "ors-sachet", name: "ORS sachets", unit: "sachets", base: 40, lead: 5 },
  { id: "metformin-500", name: "Metformin 500 mg", unit: "tablets", base: 80, lead: 10 },
  { id: "ifa-tablet", name: "Iron-Folic Acid", unit: "tablets", base: 90, lead: 7 },
  { id: "insulin-vial", name: "Insulin (regular) vials", unit: "vials", base: 3, lead: 14 },
] as const;

const DIAGNOSTICS = [
  { id: "malaria-rdt", name: "Malaria RDT", base: 8, chcOnly: false },
  { id: "haemoglobin", name: "Haemoglobin", base: 12, chcOnly: false },
  { id: "blood-glucose", name: "Blood glucose", base: 15, chcOnly: false },
  { id: "urine-pregnancy", name: "Urine pregnancy", base: 5, chcOnly: false },
  { id: "dengue-ns1", name: "Dengue NS1", base: 4, chcOnly: true },
  { id: "tb-sputum", name: "TB sputum microscopy", base: 3, chcOnly: true },
] as const;

/** mulberry32: small deterministic PRNG. */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function series(rng: () => number, base: number, days: number, variation = 0.25): number[] {
  return Array.from({ length: days }, (_, day) => {
    const weekly = day % 7 === 6 ? 0.7 : 1;
    const noise = 1 + (rng() * 2 - 1) * variation;
    return Math.max(0, Math.round(base * weekly * noise));
  });
}

function positionFor(spec: FacilitySpec, index: number): { x: number; z: number } {
  const hubIndex = SPECS.filter((s) => s.type === "CHC").findIndex((s) => s.id === (spec.hub ?? spec.id));
  const hubAngle = (hubIndex / 3) * Math.PI * 2 - Math.PI / 2;
  const hub = { x: Math.cos(hubAngle) * 13, z: Math.sin(hubAngle) * 13 };
  if (spec.type === "CHC") return round(hub);
  const siblings = SPECS.filter((s) => s.hub === spec.hub);
  const k = siblings.findIndex((s) => s.id === spec.id);
  const angle = hubAngle + ((k - 1) * Math.PI) / 3.2 + (index % 2 ? 0.1 : -0.1);
  return round({ x: hub.x + Math.cos(angle) * 7.5, z: hub.z + Math.sin(angle) * 7.5 });
}

function round(p: { x: number; z: number }) {
  return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 };
}

function buildMedicines(spec: FacilitySpec, rng: () => number): MedicineStock[] {
  const scale = spec.type === "CHC" ? 2.5 : 1;
  return MEDICINES.map((m, i) => {
    const base = m.base * scale;
    const dailyConsumption = series(rng, base, SEED_HISTORY_DAYS);
    let coverDays = 20 + rng() * 20;
    if (spec.profile === "surplus") coverDays = 55 + rng() * 15;
    if (spec.profile === "stockout" && (m.id === "ors-sachet" || m.id === "paracetamol-500")) coverDays = 1.5 + rng() * 1.5;
    if (spec.profile === "stockout" && m.id === "amoxicillin-250") coverDays = 10;
    if (spec.profile === "healthy" && i === 3 && spec.type === "CHC") coverDays = 15;
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      essential: true,
      quantity: Math.round(base * coverDays),
      reserved: 0,
      reorderLevel: Math.round(base * m.lead * 1.5),
      leadTimeDays: m.lead,
      dailyConsumption,
    };
  });
}

function buildDiagnostics(spec: FacilitySpec, rng: () => number): DiagnosticTest[] {
  return DIAGNOSTICS.filter((d) => spec.type === "CHC" || !d.chcOnly).map((d, i) => {
    const dailyUsage = d.base * (spec.type === "CHC" ? 2 : 1);
    const unavailable = spec.profile === "diagnostics" && i < 2;
    const low = spec.profile === "diagnostics" && i === 2;
    const kitsRemaining = unavailable ? 0 : low ? Math.round(dailyUsage * 2) : Math.round(dailyUsage * (12 + rng() * 20));
    return { id: d.id, name: d.name, available: !unavailable, kitsRemaining, dailyUsage };
  });
}

export function buildSeedDistrict(historyEndDate: string): District {
  return { id: SEED_DISTRICT_ID, name: "Vellora District", synthetic: true, historyEndDate };
}

export function buildSeedFacilities(updatedAt: string): Facility[] {
  return SPECS.map((spec, index) => {
    const rng = createRng(hash(spec.id));
    const isChc = spec.type === "CHC";
    const bedsTotal = isChc ? 30 : 6;
    const occupancy = spec.profile === "beds" ? 0.97 : 0.4 + rng() * 0.3;
    const scheduled = isChc ? 6 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2);
    const present = spec.profile === "staffing" ? Math.floor(scheduled * 0.4) : scheduled - (rng() < 0.3 ? 1 : 0);
    const footfallBase = isChc ? 190 + rng() * 60 : 55 + rng() * 35;

    const links = spec.hub
      ? [spec.hub]
      : SPECS.filter((s) => s.type === "CHC" && s.id !== spec.id).map((s) => s.id);

    return {
      id: spec.id,
      name: spec.name,
      type: spec.type,
      block: spec.block,
      position: positionFor(spec, index),
      links,
      beds: { total: bedsTotal, occupied: Math.min(bedsTotal, Math.round(bedsTotal * occupancy)) },
      doctors: { scheduled, present },
      footfall: series(rng, footfallBase, SEED_HISTORY_DAYS, 0.18),
      medicines: buildMedicines(spec, rng),
      diagnostics: buildDiagnostics(spec, rng),
      updatedAt,
    };
  });
}
