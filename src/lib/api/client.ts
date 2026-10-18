"use client";

import type { ApiEnvelope } from "./envelope";

const LOCAL_MODE = process.env.NEXT_PUBLIC_AUTH_MODE === "local";
const LOCAL_SESSION_KEY = "local-demo-session";

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

async function authorizationHeader(): Promise<string> {
  if (LOCAL_MODE) {
    let session = sessionStorage.getItem(LOCAL_SESSION_KEY);
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem(LOCAL_SESSION_KEY, session);
    }
    return `Local ${session}`;
  }
  const { getAnonymousIdToken } = await import("@/lib/firebase/client");
  return `Bearer ${await getAnonymousIdToken()}`;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", await authorizationHeader());
  const response = await fetch(path, { ...init, headers, cache: "no-store" });

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError("INVALID_RESPONSE", `Unexpected response (${response.status}).`);
  }
  if (!body.ok) throw new ApiClientError(body.error.code, body.error.message, body.requestId);
  return body.data;
}
