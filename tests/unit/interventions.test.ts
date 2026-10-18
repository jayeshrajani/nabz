import { describe, expect, it } from "vitest";
import { buildDistrictView } from "@/domain/district";
import { flagInterventions, PATIENTS_PER_DOCTOR_LIMIT } from "@/domain/interventions";
import { assessFacility } from "@/domain/risk";
import type { Facility } from "@/domain/schemas";
import { buildSeedDistrict, buildSeedFacilities } from "@/domain/seed";

const base: Facility = {
  id: "phc-a",
  name: "PHC A",
  type: "PHC",
  block: "B",
  position: { x: 0, z: 0 },
  links: [],
  beds: { total: 10, occupied: 2 },
  doctors: { scheduled: 4, present: 4 },
  footfall: [40, 40, 40, 40, 40, 40, 40, 40],
  medicines: [],
  diagnostics: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const flag = (f: Facility) => flagInterventions([{ facility: f, assessment: assessFacility(f) }], []);

describe("flagInterventions", () => {
  it("does not flag a healthy centre", () => {
    expect(flag(base)).toEqual([]);
  });

  it("flags doctor absence as underperforming and recommends relief", () => {
    const [f] = flag({ ...base, doctors: { scheduled: 4, present: 1 } });
    expect(f).toMatchObject({ priority: "urgent", kinds: ["underperforming"], actions: ["deployRelief"] });
  });

  it("flags full beds and patient overload as under-resourced", () => {
    const today = (PATIENTS_PER_DOCTOR_LIMIT + 10) * 2;
    const [f] = flag({
      ...base,
      beds: { total: 10, occupied: 10 },
      doctors: { scheduled: 2, present: 2 },
      footfall: [...base.footfall, today],
    });
    expect(f!.kinds).toContain("underResourced");
    expect(f!.actions).toEqual(expect.arrayContaining(["referPatients", "surgeSupport"]));
    expect(f!.patientsPerDoctor).toBe(today / 2);
  });

  it("recommends a transfer when one is suggested, otherwise an emergency restock", () => {
    const med = {
      id: "ors",
      name: "ORS",
      unit: "sachets",
      essential: true,
      quantity: 0,
      reserved: 0,
      reorderLevel: 10,
      leadTimeDays: 5,
      dailyConsumption: [5, 5, 5, 5, 5, 5, 5],
    };
    const f = { ...base, medicines: [med] };
    const assessed = [{ facility: f, assessment: assessFacility(f) }];
    expect(flagInterventions(assessed, [])[0]!.actions).toContain("emergencyRestock");
    const suggestion = { toFacilityId: f.id } as Parameters<typeof flagInterventions>[1][number];
    expect(flagInterventions(assessed, [suggestion])[0]!.actions).toContain("approveTransfer");
  });

  it("flags at least one centre in the seeded district, worst first", () => {
    const view = buildDistrictView(buildSeedDistrict("2026-01-01"), buildSeedFacilities("2026-01-01T00:00:00.000Z"));
    expect(view.interventions.length).toBeGreaterThan(0);
    const scores = view.interventions.map((i) => i.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
