import type { ErrorCode } from "@/lib/errors/app-error";

export type ApiSuccess<T> = { ok: true; data: T; requestId: string };
export type ApiFailure = { ok: false; error: { code: ErrorCode; message: string }; requestId: string };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
