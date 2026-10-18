import type { z } from "zod";
import { AppError } from "@/lib/errors/app-error";

export const MAX_BODY_BYTES = 8 * 1024;

/** Reads the body chunk by chunk and aborts once it exceeds `maxBytes`, whatever Content-Length claims. */
async function readBounded(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S, maxBytes = MAX_BODY_BYTES): Promise<z.infer<S>> {
  const contentType = request.headers.get("content-type");
  if (contentType && !/^application\/json\b/i.test(contentType)) throw new AppError("VALIDATION_FAILED", "Content-Type must be application/json.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");

  const text = await readBounded(request, maxBytes);

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
