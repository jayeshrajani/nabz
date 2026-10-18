import { describe, expect, it, vi } from "vitest";
import { createAuthenticator, isLocalAuthEnabled } from "@/lib/auth/authenticate";
import { AppError } from "@/lib/errors/app-error";

const LOCAL_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const req = (authorization?: string) => new Request("http://test/api", { headers: authorization ? { authorization } : {} });

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("authenticate", () => {
  const verifyIdToken = vi.fn(async (token: string) => {
    if (token === "anon") return { uid: "user-1", signInProvider: "anonymous" };
    if (token === "google") return { uid: "user-2", signInProvider: "google.com" };
    throw new Error("bad token");
  });
  const auth = createAuthenticator({ verifyIdToken, localModeEnabled: false });

  it("rejects missing credentials", async () => {
    await expectCode(auth(req()), "UNAUTHENTICATED");
  });

  it("rejects invalid tokens", async () => {
    await expectCode(auth(req("Bearer nope")), "UNAUTHENTICATED");
  });

  it("rejects unknown schemes and oversized tokens", async () => {
    await expectCode(auth(req("Basic abc")), "UNAUTHENTICATED");
    await expectCode(auth(req(`Bearer ${"x".repeat(5000)}`)), "UNAUTHENTICATED");
  });

  it("scopes anonymous users to their own session", async () => {
    await expect(auth(req("Bearer anon"))).resolves.toEqual({ uid: "user-1", role: "demo_user", sessionId: "user-1" });
  });

  it("forbids non-provisioned accounts", async () => {
    await expectCode(auth(req("Bearer google")), "FORBIDDEN");
  });

  it("rejects local credentials when local mode is off", async () => {
    await expectCode(auth(req(`Local ${LOCAL_ID}`)), "UNAUTHENTICATED");
  });

  it("accepts only well-formed local session IDs when enabled", async () => {
    const local = createAuthenticator({ verifyIdToken, localModeEnabled: true });
    await expect(local(req(`Local ${LOCAL_ID}`))).resolves.toMatchObject({ sessionId: `local-${LOCAL_ID}` });
    await expectCode(local(req("Local ../../other-session")), "UNAUTHENTICATED");
  });
});

describe("isLocalAuthEnabled", () => {
  it("is never enabled in production", () => {
    expect(isLocalAuthEnabled({ AUTH_MODE: "local", NODE_ENV: "production" })).toBe(false);
    expect(isLocalAuthEnabled({ AUTH_MODE: "local", NODE_ENV: "development" })).toBe(true);
    expect(isLocalAuthEnabled({ NODE_ENV: "development" })).toBe(false);
  });
});
