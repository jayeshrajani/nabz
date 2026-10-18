"use client";

import { useCallback, useEffect, useState } from "react";
import type { FacilityDetail } from "@/domain/district";
import type { AuditEvent, FacilityUpdate } from "@/domain/operations";
import { apiRequest } from "@/lib/api/client";
import { ensureSession } from "@/lib/api/session";

export type FacilityState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: FacilityDetail };

export type SubmitResult = { ok: true; summary: string } | { ok: false; message: string };

export function useFacility(id: string) {
  const [state, setState] = useState<FacilityState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    ensureSession()
      .then(() => apiRequest<FacilityDetail>(`/api/facilities/${encodeURIComponent(id)}`))
      .then(
        (detail) => !cancelled && setState({ status: "ready", detail }),
        (error: unknown) =>
          !cancelled && setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load this centre." }),
      );
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const submit = useCallback(
    async (update: FacilityUpdate): Promise<SubmitResult> => {
      try {
        const res = await apiRequest<{ audit: AuditEvent; detail: FacilityDetail }>(`/api/facilities/${encodeURIComponent(id)}/updates`, {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify(update),
        });
        setState({ status: "ready", detail: res.detail });
        return { ok: true, summary: res.audit.summary };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Could not save." };
      }
    },
    [id],
  );

  return { state, reload, submit };
}
