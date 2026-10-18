import { afterEach, describe, expect, it, vi } from "vitest";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors/app-error";

describe("apiHandler", () => {
  afterEach(() => vi.restoreAllMocks());

  it("wraps data in a success envelope with a request id", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await apiHandler("op", async () => ({ n: 1 }))(new Request("http://t"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { n: 1 } });
    expect(res.headers.get("x-request-id")).toBe(body.requestId);
  });

  it("propagates a well-formed incoming request id and ignores malformed ones", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = apiHandler("op", async () => null);
    const good = await handler(new Request("http://t", { headers: { "x-request-id": "abcd-1234-efgh" } }));
    expect(good.headers.get("x-request-id")).toBe("abcd-1234-efgh");
    const bad = await handler(new Request("http://t", { headers: { "x-request-id": "<script>" } }));
    expect(bad.headers.get("x-request-id")).not.toBe("<script>");
  });

  it("maps AppError to its status and safe message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await apiHandler("op", async () => {
      throw new AppError("FORBIDDEN", "Nope.");
    })(new Request("http://t"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN", message: "Nope." } });
  });

  it("hides internal error details from clients", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await apiHandler("op", async () => {
      throw new Error("db password=hunter2 leaked");
    })(new Request("http://t"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toEqual({ code: "INTERNAL", message: "An unexpected error occurred." });
    expect(JSON.parse(errorLog.mock.calls[0]![0] as string)).toMatchObject({
      severity: "ERROR",
      operation: "op",
      errorCategory: "INTERNAL",
    });
  });
});
