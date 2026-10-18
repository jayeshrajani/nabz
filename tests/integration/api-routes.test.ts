import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Exercises the real route handlers end-to-end against the in-memory repository in local auth mode.
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

type Routes = {
  session: typeof import("@/app/api/session/route");
  facilities: typeof import("@/app/api/facilities/route");
};
let routes: Routes;

const req = (method: string, auth?: string) =>
  new Request("http://test/api", { method, headers: auth ? { authorization: `Local ${auth}` } : {} });

beforeAll(async () => {
  vi.stubEnv("AUTH_MODE", "local");
  vi.stubEnv("DATA_BACKEND", "memory");
  vi.stubEnv("NODE_ENV", "test");
  routes = {
    session: await import("@/app/api/session/route"),
    facilities: await import("@/app/api/facilities/route"),
  };
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("session + facilities API", () => {
  it("rejects unauthenticated requests with an error envelope", async () => {
    const res = await routes.facilities.GET(req("GET"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("returns 404 before the session is bootstrapped", async () => {
    const res = await routes.facilities.GET(req("GET", A));
    expect(res.status).toBe(404);
  });

  it("bootstraps idempotently and returns assessed facilities", async () => {
    const first = await (await routes.session.POST(req("POST", A))).json();
    const second = await (await routes.session.POST(req("POST", A))).json();
    expect(first.data.created).toBe(true);
    expect(second.data.created).toBe(false);

    const body = await (await routes.facilities.GET(req("GET", A))).json();
    expect(body.ok).toBe(true);
    expect(body.data.facilities).toHaveLength(12);
    expect(body.data.district.synthetic).toBe(true);
  });

  it("does not expose one session's data to another", async () => {
    const res = await routes.facilities.GET(req("GET", B));
    expect(res.status).toBe(404);
  });
});
