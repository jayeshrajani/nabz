"use client";

import { apiRequest } from "./client";

let sessionReady: Promise<unknown> | null = null;

/** Provisions the caller's sandbox once per page load; retried on failure. */
export function ensureSession(): Promise<unknown> {
  sessionReady ??= apiRequest("/api/session", { method: "POST" }).catch((error: unknown) => {
    sessionReady = null;
    throw error;
  });
  return sessionReady;
}
