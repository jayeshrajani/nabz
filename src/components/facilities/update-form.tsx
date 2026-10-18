"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import type { FacilityUpdate } from "@/domain/operations";
import type { SubmitResult } from "@/features/facility/use-facility";
import { cn } from "@/lib/utils";

export type Submit = (update: FacilityUpdate) => Promise<SubmitResult>;

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-ink-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="tabular h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:border-brand"
      />
    </label>
  );
}

/** Handles pending, success and error states for a single update submission. */
export function UpdateForm({
  submit,
  build,
  children,
  label = "Save",
  className,
}: {
  submit: Submit;
  build: () => FacilityUpdate | string;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<{ kind: "idle" | "pending" | "done" | "error"; message?: string }>({ kind: "idle" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const update = build();
    if (typeof update === "string") return setStatus({ kind: "error", message: update });
    setStatus({ kind: "pending" });
    const result = await submit(update);
    setStatus(result.ok ? { kind: "done", message: result.summary } : { kind: "error", message: result.message });
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <div className="flex flex-wrap items-end gap-2">
        {children}
        <button
          type="submit"
          disabled={status.kind === "pending"}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-60"
        >
          {status.kind === "pending" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {label}
        </button>
      </div>
      <p aria-live="polite" className={cn("mt-2 min-h-5 text-xs", status.kind === "error" ? "text-alert-ink" : "text-ok-ink")}>
        {status.kind === "done" && (
          <span className="inline-flex items-center gap-1">
            <Check aria-hidden className="size-3.5" /> {status.message}
          </span>
        )}
        {status.kind === "error" && status.message}
      </p>
    </form>
  );
}

export const isCount = (v: number) => Number.isInteger(v) && v >= 0;
