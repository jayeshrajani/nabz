import type { z } from "zod";
import { AppError } from "@/lib/errors/app-error";

export const MAX_BODY_BYTES = 8 * 1024;

export async function readJson<S extends z.ZodType>(request: Request, schema: S, maxBytes = MAX_BODY_BYTES): Promise<z.infer<S>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_FAILED", "Body must be valid JSON.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new AppError("VALIDATION_FAILED", `${where}${issue?.message ?? "Invalid request."}`);
  }
  return parsed.data;
}

const ID = /^[a-z0-9-]{1,64}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;

export function idempotencyKey(request: Request): string | undefined {
  const key = request.headers.get("idempotency-key") ?? undefined;
  if (key !== undefined && !IDEMPOTENCY_KEY.test(key)) throw new AppError("VALIDATION_FAILED", "Malformed Idempotency-Key header.");
  return key;
}

export function parseId(value: string): string {
  if (!ID.test(value)) throw new AppError("NOT_FOUND", "Centre not found.");
  return value;
}
