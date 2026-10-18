import { describe, expect, it } from "vitest";
import { z } from "zod";
import nextConfig, { CONTENT_SECURITY_POLICY } from "../../next.config";
import { readJson } from "@/lib/api/request";
import { isLocalAuthEnabled } from "@/lib/auth/authenticate";
import { AppError } from "@/lib/errors/app-error";
import { redact } from "@/lib/observability/logger";

const Schema = z.object({ n: z.number() });
const post = (body: string, headers: Record<string, string> = { "content-type": "application/json" }) =>
  new Request("http://test/api", { method: "POST", body, headers });

describe("security headers", () => {
  it("sends CSP, HSTS and anti-framing headers on every route", async () => {
    const [rule] = await nextConfig.headers!();
    const keys = rule!.headers.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(["Content-Security-Policy", "Strict-Transport-Security", "X-Frame-Options", "X-Content-Type-Options"]));
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });
});

describe("readJson", () => {
  it("parses valid JSON bodies", async () => {
    await expect(readJson(post('{"n":1}'), Schema)).resolves.toEqual({ n: 1 });
  });

  it("rejects non-JSON content types", async () => {
    await expect(readJson(post('{"n":1}', { "content-type": "text/plain" }), Schema)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects oversized bodies with 413", async () => {
    const error = await readJson(post(JSON.stringify({ n: 1, pad: "x".repeat(100) })), Schema, 32).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(413);
  });

  it("stops reading a streamed body once it exceeds the cap, regardless of Content-Length", async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new TextEncoder().encode("x".repeat(16)));
        if (pulled > 1000) controller.close();
      },
    });
    const request = new Request("http://test/api", { method: "POST", body, headers: { "content-type": "application/json" }, duplex: "half" } as RequestInit);
    await expect(readJson(request, Schema, 64)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(pulled).toBeLessThan(10);
  });

  it("rejects malformed JSON and schema violations", async () => {
    await expect(readJson(post("{"), Schema)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(readJson(post('{"n":"x"}'), Schema)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("local auth mode", () => {
  it("fails closed unless the environment is explicitly development or test", () => {
    expect(isLocalAuthEnabled({ AUTH_MODE: "local", NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isLocalAuthEnabled({ AUTH_MODE: "local", NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isLocalAuthEnabled({ AUTH_MODE: "local" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("log redaction", () => {
  it("redacts sensitive keys and token-like values, including nested fields", () => {
    const out = redact({ apiKey: "k", note: "sent Bearer abc.def", nested: { password: "p", key: "AIzaSyA1234567890123456789012" } });
    expect(out.apiKey).toBe("[redacted]");
    expect(out.note).not.toContain("abc.def");
    expect(out.nested).toEqual({ password: "[redacted]", key: "[redacted]" });
  });
});
