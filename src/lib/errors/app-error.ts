import { DomainRuleError } from "@/domain/operations";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RULE_VIOLATION"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RULE_VIOLATION: 422,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** Errors whose message is safe to return to clients. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof DomainRuleError) return new AppError("RULE_VIOLATION", error.message, { cause: error });
  return new AppError("INTERNAL", "An unexpected error occurred.", { cause: error });
}
