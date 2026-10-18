import { can, type Capability, type Principal } from "@/lib/auth/roles";
import { authenticate } from "@/lib/auth/server";
import { AppError } from "@/lib/errors/app-error";
import { createRateLimiter } from "./rate-limit";

const MINUTE = 60_000;

/** Per-user request budgets per minute, per instance. */
export const RATE_LIMITS = { read: 120, write: 30, session: 10, assistant: 12 } as const;
export type RateBucket = keyof typeof RATE_LIMITS;

const limiters = Object.fromEntries(
  Object.entries(RATE_LIMITS).map(([bucket, limit]) => [bucket, createRateLimiter(limit, MINUTE)]),
) as Record<RateBucket, (key: string) => boolean>;

/** Authenticates, enforces the capability (if any) and applies the per-user rate limit. */
export async function authorize(request: Request, capability: Capability | null, bucket: RateBucket): Promise<Principal> {
  const principal = await authenticate(request);
  if (capability && !can(principal, capability)) throw new AppError("FORBIDDEN", `Missing ${capability} capability.`);
  if (!limiters[bucket](principal.uid)) throw new AppError("RATE_LIMITED", "Too many requests. Try again in a minute.");
  return principal;
}
