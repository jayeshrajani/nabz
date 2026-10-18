"use client";

import { useState } from "react";
import { FootfallChart } from "@/components/charts/footfall-chart";
import { SEVERITY_META } from "@/components/ui/status-badge";
import type { FacilityDetail } from "@/domain/district";
import type { StockForecast } from "@/domain/forecast";
import { formatDays } from "@/domain/risk";
import type { MedicineStock } from "@/domain/schemas";
import { cn } from "@/lib/utils";
import { isCount, NumberField, UpdateForm, type Submit } from "./update-form";

const nf = new Intl.NumberFormat("en-IN");

function Card({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = `card-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("card p-6", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function PatientsSection({ detail, submit }: { detail: FacilityDetail; submit: Submit }) {
  const { footfall } = detail;
  const [today, setToday] = useState(footfall.today ?? 0);
  const next = footfall.forecast?.points;
  const avgNext = next ? Math.round(next.reduce((s, p) => s + p.expected, 0) / next.length) : null;
  const low = next ? Math.round(Math.min(...next.map((p) => p.low))) : null;
  const high = next ? Math.round(Math.max(...next.map((p) => p.high))) : null;

  return (
    <Card
      title="Patients"
      className="lg:col-span-8"
      aside={footfall.surge ? <span className="rounded-full bg-watch-soft px-2.5 py-0.5 text-xs font-medium text-watch-ink">Busier than usual</span> : null}
    >
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <div>
          <p className="tabular font-display text-4xl font-semibold">{footfall.today ?? "n/a"}</p>
          <p className="text-sm text-ink-muted">today{footfall.usual !== null && `, usually about ${Math.round(footfall.usual)}`}</p>
        </div>
        {avgNext !== null && (
          <p className="max-w-xs text-sm text-ink-muted">
            Next week, expect around <strong className="font-semibold text-ink">{avgNext} a day</strong>
            {low !== null && high !== null && ` (anywhere from ${low} to ${high} on a given day).`}
          </p>
        )}
      </div>
      <div className="mt-5">
        <FootfallChart history={detail.facility.footfall} endDate={detail.district.historyEndDate} forecast={footfall.forecast} />
      </div>
      <UpdateForm
        submit={submit}
        className="mt-4 border-t border-line pt-4"
        label="Update count"
        build={() => (isCount(today) ? { kind: "footfall", today } : "Enter a whole number of patients.")}
      >
        <NumberField label="Patients seen today" value={today} onChange={setToday} className="w-44" />
      </UpdateForm>
    </Card>
  );
}

function Meter({ value, max, tone }: { value: number; max: number; tone: string }) {
  return (
    <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: tone }} />
    </div>
  );
}

export function RightNowSection({ detail, submit }: { detail: FacilityDetail; submit: Submit }) {
  const { beds, doctors } = detail.facility;
  const [occupied, setOccupied] = useState(beds.occupied);
  const [total, setTotal] = useState(beds.total);
  const [present, setPresent] = useState(doctors.present);
  const [scheduled, setScheduled] = useState(doctors.scheduled);
  const bedSignal = detail.assessment.signals.find((s) => s.domain === "beds");
  const staffSignal = detail.assessment.signals.find((s) => s.domain === "staffing");

  return (
    <Card title="Right now" className="lg:col-span-4">
      <div className="space-y-6">
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-ink-muted">Beds free</p>
            <p className="tabular font-display text-2xl font-semibold">
              {beds.total - beds.occupied}
              <span className="text-base text-ink-subtle"> / {beds.total}</span>
            </p>
          </div>
          <Meter value={beds.occupied} max={beds.total} tone={bedSignal ? SEVERITY_META[bedSignal.severity].hex : "#2f9e76"} />
          <UpdateForm
            submit={submit}
            className="mt-3"
            label="Save"
            build={() =>
              !isCount(occupied) || !isCount(total) ? "Use whole numbers." : occupied > total ? "Occupied can't be more than total." : { kind: "beds", occupied, total }
            }
          >
            <NumberField label="Occupied" value={occupied} onChange={setOccupied} max={total} className="w-24" />
            <NumberField label="Total" value={total} onChange={setTotal} className="w-24" />
          </UpdateForm>
        </div>

        <div className="border-t border-line pt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-ink-muted">Doctors in today</p>
            <p className="tabular font-display text-2xl font-semibold">
              {doctors.present}
              <span className="text-base text-ink-subtle"> / {doctors.scheduled}</span>
            </p>
          </div>
          <Meter value={doctors.present} max={doctors.scheduled} tone={staffSignal ? SEVERITY_META[staffSignal.severity].hex : "#2f9e76"} />
          <UpdateForm
            submit={submit}
            className="mt-3"
            label="Save"
            build={() =>
              !isCount(present) || !isCount(scheduled)
                ? "Use whole numbers."
                : present > scheduled
                  ? "Present can't be more than scheduled."
                  : { kind: "attendance", present, scheduled }
            }
          >
            <NumberField label="Present" value={present} onChange={setPresent} max={scheduled} className="w-24" />
            <NumberField label="Rostered" value={scheduled} onChange={setScheduled} className="w-24" />
          </UpdateForm>
        </div>
      </div>
    </Card>
  );
}

const MOVES = [
  { id: "receive", label: "Received" },
  { id: "issue", label: "Used" },
  { id: "count", label: "Counted" },
] as const;

function StockForm({ medicine, submit }: { medicine: MedicineStock; submit: Submit }) {
  const [movement, setMovement] = useState<(typeof MOVES)[number]["id"]>("receive");
  const [quantity, setQuantity] = useState(0);
  return (
    <UpdateForm
      submit={submit}
      className="px-1 pt-3 pb-1"
      label="Record"
      build={() =>
        !isCount(quantity)
          ? "Use a whole number."
          : movement !== "count" && quantity === 0
            ? "Quantity must be more than zero."
            : movement === "issue" && quantity > medicine.quantity
              ? `Only ${nf.format(medicine.quantity)} ${medicine.unit} in stock.`
              : { kind: "stock", medicineId: medicine.id, movement, quantity }
      }
    >
      <div role="radiogroup" aria-label="Type of change" className="flex h-10 rounded-full border border-line bg-surface p-1 text-sm">
        {MOVES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={movement === m.id}
            onClick={() => setMovement(m.id)}
            className={cn("rounded-full px-3", movement === m.id ? "bg-forest text-white" : "text-ink-muted hover:text-ink")}
          >
            {m.label}
          </button>
        ))}
      </div>
      <NumberField label={movement === "count" ? `${medicine.unit} on shelf` : medicine.unit} value={quantity} onChange={setQuantity} className="w-32" />
    </UpdateForm>
  );
}

function lasts(f: StockForecast | undefined): string {
  if (!f || f.daysUntilStockOut === null) return "Not enough history";
  if (f.daysUntilStockOut === 0) return "Out of stock";
  if (!Number.isFinite(f.daysUntilStockOut)) return "Not being used";
  return `About ${formatDays(f.daysUntilStockOut)}`;
}

export function MedicinesSection({ detail, submit }: { detail: FacilityDetail; submit: Submit }) {
  const [open, setOpen] = useState<string | null>(null);
  const forecasts = new Map(detail.stock.map((s) => [s.medicineId, s]));
  const severity = new Map(detail.assessment.signals.filter((s) => s.domain === "medicine").map((s) => [s.ref, s.severity]));
  const toOrder = detail.stock.filter((s) => s.shouldReorder).length;

  return (
    <Card
      title="Medicines"
      className="lg:col-span-8"
      aside={toOrder > 0 ? <span className="text-sm text-ink-muted">{toOrder} worth reordering</span> : <span className="text-sm text-ink-muted">Shelves look fine</span>}
    >
      <ul className="divide-y divide-line">
        {detail.facility.medicines.map((m) => {
          const f = forecasts.get(m.id);
          const sev = severity.get(m.id);
          const isOpen = open === m.id;
          return (
            <li key={m.id} className="py-3">
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto]">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name}</p>
                  {f?.shouldReorder && f.suggestedOrder > 0 && (
                    <p className="text-xs text-brand">
                      Order about {nf.format(f.suggestedOrder)} {m.unit} to stay covered for two weeks
                    </p>
                  )}
                </div>
                <p className="tabular hidden text-sm text-ink-muted sm:block">
                  {nf.format(m.quantity)} {m.unit}
                </p>
                <p className={cn("tabular hidden text-sm sm:block", sev ? `font-medium ${SEVERITY_META[sev].ink}` : "text-ink-muted")}>{lasts(f)}</p>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-muted hover:border-line-strong hover:text-ink"
                >
                  {isOpen ? "Close" : "Update"}
                </button>
                <p className="col-span-2 text-xs text-ink-muted sm:hidden">
                  {nf.format(m.quantity)} {m.unit}, <span className={sev ? SEVERITY_META[sev].ink : undefined}>{lasts(f).toLowerCase()}</span>
                </p>
              </div>
              {isOpen && <StockForm medicine={m} submit={submit} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TestRow({ test, submit }: { test: FacilityDetail["facility"]["diagnostics"][number]; submit: Submit }) {
  const [open, setOpen] = useState(false);
  const [kits, setKits] = useState(test.kitsRemaining);
  const [available, setAvailable] = useState(test.available);
  const working = test.available && test.kitsRemaining > 0;

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{test.name}</p>
          <p className={cn("text-xs", working ? "text-ink-muted" : "font-medium text-alert-ink")}>{working ? `${nf.format(test.kitsRemaining)} kits` : "Not available"}</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-muted hover:border-line-strong hover:text-ink"
        >
          {open ? "Close" : "Update"}
        </button>
      </div>
      {open && (
        <UpdateForm
          submit={submit}
          className="pt-3"
          build={() => (isCount(kits) ? { kind: "diagnostic", testId: test.id, available, kitsRemaining: kits } : "Use a whole number of kits.")}
        >
          <NumberField label="Kits left" value={kits} onChange={setKits} className="w-24" />
          <label className="flex h-10 items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="size-4 accent-brand" />
            Running
          </label>
        </UpdateForm>
      )}
    </li>
  );
}

export function TestsSection({ detail, submit }: { detail: FacilityDetail; submit: Submit }) {
  const down = detail.facility.diagnostics.filter((t) => !t.available || t.kitsRemaining === 0).length;
  return (
    <Card title="Tests" className="lg:col-span-4" aside={<span className="text-sm text-ink-muted">{down ? `${down} down` : "All running"}</span>}>
      <ul className="divide-y divide-line">
        {detail.facility.diagnostics.map((t) => (
          <TestRow key={t.id} test={t} submit={submit} />
        ))}
      </ul>
    </Card>
  );
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string): string {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export function ActivitySection({ detail }: { detail: FacilityDetail }) {
  return (
    <Card title="Recent changes" className="lg:col-span-12">
      {detail.activity.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing logged yet. Every update you make here is recorded with who made it and when.</p>
      ) : (
        <ol className="space-y-3">
          {detail.activity.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-4 text-sm">
              <span>{e.summary}</span>
              <time dateTime={e.at} className="shrink-0 text-xs text-ink-subtle">
                {ago(e.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
