import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Exercises the V2 route handlers end-to-end against the in-memory repository in local auth mode.
const A = "33333333-3333-4333-8333-333333333333";
const B = "44444444-4444-4444-8444-444444444444";
const FACILITY = "phc-nazirabad";

type Routes = {
  session: typeof import("@/app/api/session/route");
  detail: typeof import("@/app/api/facilities/[id]/route");
  updates: typeof import("@/app/api/facilities/[id]/updates/route");
};
let routes: Routes;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const auth = (s: string) => ({ authorization: `Local ${s}` });

function post(session: string | null, body: unknown, extra: Record<string, string> = {}) {
  return new Request("http://test/api", {
    method: "POST",
    headers: { ...(session ? auth(session) : {}), "content-type": "application/json", ...extra },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeAll(async () => {
  vi.stubEnv("AUTH_MODE", "local");
  vi.stubEnv("DATA_BACKEND", "memory");
  vi.stubEnv("NODE_ENV", "test");
  routes = {
    session: await import("@/app/api/session/route"),
    detail: await import("@/app/api/facilities/[id]/route"),
    updates: await import("@/app/api/facilities/[id]/updates/route"),
  };
  for (const s of [A, B]) await routes.session.POST(new Request("http://test", { method: "POST", headers: auth(s) }));
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/facilities/[id]", () => {
  it("returns assessment, stock forecasts and footfall outlook", async () => {
    const res = await routes.detail.GET(new Request("http://test", { headers: auth(A) }), ctx(FACILITY));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.facility.id).toBe(FACILITY);
    expect(body.data.stock).toHaveLength(body.data.facility.medicines.length);
    expect(body.data.footfall.forecast.points).toHaveLength(7);
  });

  it("404s for unknown or malformed ids", async () => {
    expect((await routes.detail.GET(new Request("http://test", { headers: auth(A) }), ctx("nope"))).status).toBe(404);
    expect((await routes.detail.GET(new Request("http://test", { headers: auth(A) }), ctx("../etc"))).status).toBe(404);
  });
});

describe("POST /api/facilities/[id]/updates", () => {
  it("requires authentication", async () => {
    const res = await routes.updates.POST(post(null, { kind: "footfall", today: 1 }), ctx(FACILITY));
    expect(res.status).toBe(401);
  });

  it("applies a valid update and returns the refreshed detail with an audit entry", async () => {
    const res = await routes.updates.POST(post(A, { kind: "beds", occupied: 6, total: 6 }), ctx(FACILITY));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.detail.facility.beds).toEqual({ occupied: 6, total: 6 });
    expect(body.data.detail.assessment.signals.some((s: { domain: string }) => s.domain === "beds")).toBe(true);
    expect(body.data.detail.activity[0].summary).toContain("Beds");
  });

  it("does not leak updates into another session", async () => {
    const res = await routes.detail.GET(new Request("http://test", { headers: auth(B) }), ctx(FACILITY));
    expect((await res.json()).data.facility.beds.occupied).not.toBe(6);
  });

  it("rejects schema-invalid input with 400", async () => {
    const res = await routes.updates.POST(post(A, { kind: "beds", occupied: -2, total: 6 }), ctx(FACILITY));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
    expect((await routes.updates.POST(post(A, "{not json"), ctx(FACILITY))).status).toBe(400);
  });

  it("rejects rule violations with 422", async () => {
    const res = await routes.updates.POST(post(A, { kind: "attendance", present: 9, scheduled: 2 }), ctx(FACILITY));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("RULE_VIOLATION");
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await routes.updates.POST(post(A, { kind: "footfall", today: 1, pad: "x".repeat(10_000) }), ctx(FACILITY));
    expect(res.status).toBe(413);
  });

  it("replays idempotent requests without double-applying", async () => {
    const body = { kind: "stock", medicineId: "ors-sachet", movement: "receive", quantity: 25 };
    const headers = { "idempotency-key": "same-key-0001" };
    const first = await (await routes.updates.POST(post(A, body, headers), ctx(FACILITY))).json();
    const second = await (await routes.updates.POST(post(A, body, headers), ctx(FACILITY))).json();
    const qty = (d: { facility: { medicines: { id: string; quantity: number }[] } }) => d.facility.medicines.find((m) => m.id === "ors-sachet")!.quantity;
    expect(second.data.replayed).toBe(true);
    expect(qty(second.data.detail)).toBe(qty(first.data.detail));
  });

  it("rejects malformed idempotency keys", async () => {
    const res = await routes.updates.POST(post(A, { kind: "footfall", today: 1 }, { "idempotency-key": "bad key!" }), ctx(FACILITY));
    expect(res.status).toBe(400);
  });
});
