"use client";

import { ArrowDown, ArrowUp, BedDouble, Building2, Search, Stethoscope, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SEVERITY_META, StatusBadge } from "@/components/ui/status-badge";
import { Sparkline } from "@/components/ui/sparkline";
import { Tile } from "@/components/ui/tile";
import type { DistrictView } from "@/domain/district";
import { centreRows, type CentreRow } from "@/domain/insights";
import type { MessageKey } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { DistrictGate } from "./district-gate";

type SortKey = "status" | "name" | "patients" | "beds" | "doctors" | "medicines" | "tests";
type Filter = "all" | "attention" | "stable";

const RANK = { critical: 0, warning: 1, healthy: 2 } as const;
const SORTERS: Record<SortKey, (a: CentreRow, b: CentreRow) => number> = {
  status: (a, b) => RANK[a.status] - RANK[b.status] || b.signals - a.signals,
  name: (a, b) => a.name.localeCompare(b.name),
  patients: (a, b) => (b.patientsToday ?? 0) - (a.patientsToday ?? 0),
  beds: (a, b) => a.bedsFree / Math.max(1, a.bedsTotal) - b.bedsFree / Math.max(1, b.bedsTotal),
  doctors: (a, b) => a.doctorsPresent / Math.max(1, a.doctorsRostered) - b.doctorsPresent / Math.max(1, b.doctorsRostered),
  medicines: (a, b) => b.medicinesAtRisk - a.medicinesAtRisk,
  tests: (a, b) => b.testsDown - a.testsDown,
};

const COLUMNS: { key: SortKey; label: MessageKey; className?: string }[] = [
  { key: "name", label: "centres.col.centre" },
  { key: "status", label: "centres.col.status" },
  { key: "patients", label: "centres.col.patients", className: "text-right" },
  { key: "beds", label: "centres.col.beds" },
  { key: "doctors", label: "centres.col.doctors" },
  { key: "medicines", label: "centres.col.medicines", className: "text-center" },
  { key: "tests", label: "centres.col.tests", className: "text-center" },
];

function Ratio({ value, total, warn }: { value: number; total: number; warn: boolean }) {
  return (
    <div className="flex min-w-[90px] items-center gap-2">
      <span className="tabular w-10 text-sm">
        {value}
        <span className="text-ink-subtle">/{total}</span>
      </span>
      <span aria-hidden className="h-1.5 flex-1 rounded-full bg-surface-2">
        <span className={cn("block h-full rounded-full", warn ? "bg-watch" : "bg-ok")} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
      </span>
    </div>
  );
}

export function CentresView() {
  const { t, number } = useI18n();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "status", dir: 1 });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  return (
    <DistrictGate>
      {(view) => {
        const all = centreRows(view);
        return (
          <CentresBody
            rows={all}
            view={view}
            sort={sort}
            setSort={setSort}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
            t={t}
            number={number}
          />
        );
      }}
    </DistrictGate>
  );
}

function CentresBody({
  rows: all,
  view,
  sort,
  setSort,
  filter,
  setFilter,
  query,
  setQuery,
  t,
  number,
}: {
  rows: CentreRow[];
  view: DistrictView;
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  query: string;
  setQuery: (q: string) => void;
  t: ReturnType<typeof useI18n>["t"];
  number: (n: number) => string;
}) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => (filter === "attention" ? r.status !== "healthy" : filter === "stable" ? r.status === "healthy" : true))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.block.toLowerCase().includes(q))
      .sort((a, b) => SORTERS[sort.key](a, b) * sort.dir);
  }, [all, filter, query, sort]);

  const { summary } = view;
  const patients = all.reduce((s, r) => s + (r.patientsToday ?? 0), 0);
  const doctors = all.reduce((s, r) => s + r.doctorsPresent, 0);
  const rostered = all.reduce((s, r) => s + r.doctorsRostered, 0);

  const stats = [
    { icon: Building2, label: t("centres.title"), value: number(summary.facilities), sub: `${summary.critical} ${t("status.critical")}, ${summary.warning} ${t("status.warning")}` },
    { icon: Users, label: t("centres.col.patients"), value: number(patients), sub: view.district.name },
    { icon: BedDouble, label: t("centres.col.beds"), value: number(summary.bedsTotal - summary.bedsOccupied), sub: t("kpi.of", { n: number(summary.bedsTotal) }) },
    { icon: Stethoscope, label: t("centres.col.doctors"), value: number(doctors), sub: t("kpi.of", { n: number(rostered) }) },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow text-ink-subtle">{view.district.name}</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t("centres.title")}</h1>
        <p className="max-w-2xl text-base text-ink-muted">{t("centres.subtitle")}</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <li key={s.label} className={cn("rounded-[22px] p-5", i === 0 ? "bg-forest text-white" : "border border-line bg-surface shadow-(--shadow-card)")}>
            <p className={cn("flex items-center gap-2 text-xs", i === 0 ? "text-white/60" : "text-ink-muted")}>
              <s.icon aria-hidden className="size-4" /> {s.label}
            </p>
            <p className="tabular mt-3 font-display text-4xl font-semibold tracking-tight">{s.value}</p>
            <p className={cn("mt-1 text-xs", i === 0 ? "text-white/60" : "text-ink-subtle")}>{s.sub}</p>
          </li>
        ))}
      </ul>

      <Tile icon={Building2} label={t("centres.sortBy", { col: t(COLUMNS.find((c) => c.key === sort.key)!.label) })}>
        <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("directory.title")} className="flex rounded-full border border-line bg-surface p-1 text-sm">
            {(["all", "attention", "stable"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn("rounded-full px-3.5 py-1 transition-colors", filter === f ? "bg-ink text-white" : "text-ink-muted hover:text-ink")}
              >
                {t(`directory.${f}`)}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">{t("directory.search")}</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={query}
              maxLength={60}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("directory.search")}
              className="h-10 w-52 rounded-full border border-line bg-surface pr-4 pl-10 text-sm placeholder:text-ink-subtle"
            />
          </label>
        </div>

        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line">
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("px-2 pb-2 font-normal", c.className)}>
                      <button
                        type="button"
                        onClick={() => setSort({ key: c.key, dir: active ? (sort.dir === 1 ? -1 : 1) : 1 })}
                        className={cn("eyebrow inline-flex items-center gap-1 hover:text-ink", active ? "text-ink" : "text-ink-subtle")}
                      >
                        {t(c.label)}
                        {active && (sort.dir === 1 ? <ArrowDown aria-hidden className="size-3" /> : <ArrowUp aria-hidden className="size-3" />)}
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className="eyebrow px-2 pb-2 text-left font-normal text-ink-subtle">
                  {t("centres.col.trend")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.facilityId} className="group transition-colors hover:bg-surface-2">
                  <th scope="row" className="px-2 py-3 text-left font-normal">
                    <Link href={`/facilities/${r.facilityId}`} className="flex items-center gap-3">
                      <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: SEVERITY_META[r.status].hex }} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:text-brand">{r.name}</span>
                        <span className="text-xs text-ink-subtle">
                          {r.type}, {r.block}
                        </span>
                      </span>
                    </Link>
                  </th>
                  <td className="px-2 py-3">
                    <StatusBadge severity={r.status} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <span className="tabular block font-medium">{r.patientsToday ?? "-"}</span>
                    {r.patientChange !== null && (
                      <span className={cn("tabular text-xs", r.patientChange >= 30 ? "text-watch-ink" : "text-ink-subtle")}>
                        {t("centres.vsUsual", { pct: `${r.patientChange > 0 ? "+" : ""}${r.patientChange}` })}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <Ratio value={r.bedsFree} total={r.bedsTotal} warn={r.bedsTotal > 0 && r.bedsFree / r.bedsTotal < 0.15} />
                  </td>
                  <td className="px-2 py-3">
                    <Ratio value={r.doctorsPresent} total={r.doctorsRostered} warn={r.doctorsPresent / Math.max(1, r.doctorsRostered) < 0.75} />
                  </td>
                  <td className="tabular px-2 py-3 text-center">
                    <span className={cn("inline-grid size-7 place-items-center rounded-full text-xs font-medium", r.medicinesAtRisk ? "bg-alert-soft text-alert-ink" : "text-ink-subtle")}>
                      {r.medicinesAtRisk}
                    </span>
                  </td>
                  <td className="tabular px-2 py-3 text-center">
                    <span className={cn("inline-grid size-7 place-items-center rounded-full text-xs font-medium", r.testsDown ? "bg-watch-soft text-watch-ink" : "text-ink-subtle")}>
                      {r.testsDown}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <Sparkline values={r.footfall} stroke={SEVERITY_META[r.status].hex} width={110} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-12 text-center text-sm text-ink-muted">{t("directory.empty")}</p>}
        </div>
      </Tile>
    </div>
  );
}
