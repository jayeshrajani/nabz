import { toAppError } from "@/lib/errors/app-error";
import { describeError, logger } from "@/lib/observability/logger";
import type { ApiFailure, ApiSuccess } from "./envelope";

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export interface ApiContext<R = unknown> {
  request: Request;
  requestId: string;
  route: R;
}

function resolveRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
}

/** Wraps a route handler with correlation IDs, timing, structured logs and a uniform error envelope. */
export function apiHandler<T, R = unknown>(operation: string, fn: (ctx: ApiContext<R>) => Promise<T>) {
  return async (request: Request, route?: R): Promise<Response> => {
    const requestId = resolveRequestId(request);
    const started = performance.now();
    const headers = { "x-request-id": requestId, "cache-control": "no-store" };

    try {
      const data = await fn({ request, requestId, route: route as R });
      const body: ApiSuccess<T> = { ok: true, data, requestId };
      logger.info("request completed", { operation, requestId, status: 200, durationMs: Math.round(performance.now() - started) });
      return Response.json(body, { status: 200, headers });
    } catch (error) {
      const appError = toAppError(error);
      const fields = {
        operation,
        requestId,
        status: appError.status,
        errorCategory: appError.code,
        durationMs: Math.round(performance.now() - started),
        ...(appError.status >= 500 ? describeError(appError.cause ?? appError) : {}),
      };
      if (appError.status >= 500) logger.error("request failed", fields);
      else logger.warn("request rejected", fields);
      const body: ApiFailure = { ok: false, error: { code: appError.code, message: appError.message }, requestId };
      return Response.json(body, { status: appError.status, headers });
    }
  };
}
