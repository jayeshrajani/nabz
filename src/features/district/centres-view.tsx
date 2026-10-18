"use client";

import { ArrowDown, ArrowUp, BedDouble, Building2, Search, Stethoscope, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SEVERITY_META, StatusBadge } from "@/components/ui/status-badge";
import { Sparkline } from "@/components/ui/sparkline";
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
  const reduceMotion = useReducedMotion();
  const { number } = useI18n();
  return (
    <div className="flex min-w-[108px] items-center gap-3">
      <span className="tabular shrink-0 text-sm font-medium">
        {number(value)}
        <span className="font-normal text-ink-muted">/{number(total)}</span>
      </span>
      <span aria-hidden className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-ink/10">
        <motion.span
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: total ? Math.min(1, Math.max(0, value / total)) : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
          className={cn("block h-full origin-left rounded-full", warn ? "bg-watch" : "bg-ok")}
        />
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
  const reduceMotion = useReducedMotion();
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

  const distribution = [
    { status: "critical", count: summary.critical, color: "bg-alert" },
    { status: "warning", count: summary.warning, color: "bg-watch" },
    { status: "healthy", count: summary.facilities - summary.critical - summary.warning, color: "bg-ok" },
  ] as const;
  const capacity = [
    { icon: Users, label: t("centres.col.patients"), value: patients, total: null, tone: "bg-citron" },
    {
      icon: BedDouble,
      label: t("centres.col.beds"),
      value: summary.bedsTotal - summary.bedsOccupied,
      total: summary.bedsTotal,
      tone: "bg-sky",
    },
    { icon: Stethoscope, label: t("centres.col.doctors"), value: doctors, total: rostered, tone: "bg-coral" },
  ];

  return (
    <div className="min-w-0 space-y-7">
      <header className="grid gap-6 border-b border-line pb-6 lg:grid-cols-[1fr_minmax(280px,0.8fr)] lg:items-end">
        <div className="min-w-0">
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink-muted">
            <span>{view.district.name}</span>
            <span className="border-l border-line-strong pl-3">{t("common.sample")}</span>
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{t("centres.title")}</h1>
            <motion.span
              key={summary.facilities}
              initial={reduceMotion ? false : { y: 8, opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              className="tabular font-display text-3xl text-cyan sm:text-4xl"
            >
              {number(summary.facilities)}
            </motion.span>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{t("centres.subtitle")}</p>
        </div>
        <div>
          <div aria-hidden className="mb-3 flex h-3 gap-1 overflow-hidden rounded-sm bg-surface-2">
            {distribution.map((item) => (
              <span key={item.status} className="min-w-0" style={{ flex: item.count }}>
                <motion.span
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.6 }}
                  className={cn("block h-full origin-left", item.color)}
                />
              </span>
            ))}
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {distribution.map((item) => (
              <div key={item.status} className="min-w-0">
                <dt className="text-xs leading-snug text-ink-muted">{t(`status.${item.status}`)}</dt>
                <dd className="tabular mt-1 font-display text-2xl font-semibold">{number(item.count)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-0 border-y border-line sm:grid-cols-3">
        {capacity.map((item, index) => (
          <div key={item.label} className={cn("min-w-0 px-5 py-4", item.tone)}>
            <dt className="flex items-center gap-2 text-sm text-ink-muted">
              <item.icon aria-hidden className="size-4 shrink-0" />
              {item.label}
            </dt>
            <dd className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <motion.span
                key={item.value}
                initial={reduceMotion ? false : { y: 7, opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : index * 0.06 }}
                className="tabular font-display text-3xl font-semibold"
              >
                {number(item.value)}
              </motion.span>
              {item.total !== null && <span className="text-xs text-ink-muted">{t("kpi.of", { n: number(item.total) })}</span>}
            </dd>
            {item.total !== null && (
              <div aria-hidden className="mt-3 h-1 overflow-hidden bg-ink/10">
                <motion.div
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: item.total ? Math.min(1, Math.max(0, item.value / item.total)) : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.6 }}
                  className="h-full origin-left bg-forest"
                />
              </div>
            )}
          </div>
        ))}
      </dl>

      <section aria-label={t("directory.title")} className="min-w-0 bg-surface">
        <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Building2 aria-hidden className="size-4 text-cyan" />
              {t("directory.title")}
              <span className="tabular text-sm font-normal text-ink-muted">{number(rows.length)}</span>
            </h2>
            <p className="text-xs text-ink-muted">
              {t("centres.sortBy", { col: t(COLUMNS.find((column) => column.key === sort.key)!.label) })}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label={t("directory.title")} className="flex min-w-0 rounded-lg bg-surface-2 p-1 text-xs sm:text-sm">
              {(["all", "attention", "stable"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "min-h-10 min-w-0 flex-1 rounded-md px-2 py-2 transition-colors sm:flex-none sm:px-4",
                    filter === f ? "bg-ink text-white" : "text-ink-muted hover:bg-white hover:text-ink",
                  )}
                >
                  {t(`directory.${f}`)}
                </button>
              ))}
            </div>
            <label className="relative block min-w-0 sm:w-64">
              <span className="sr-only">{t("directory.search")}</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
              <input
                type="search"
                value={query}
                maxLength={60}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("directory.search")}
                className="h-11 w-full min-w-0 rounded-lg border border-line-strong bg-surface pr-4 pl-10 text-sm placeholder:text-ink-muted"
              />
            </label>
          </div>
        </div>

        <div role="region" aria-label={t("directory.title")} tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/70">
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                      className={cn("px-4 py-3 text-left font-normal", c.className)}
                    >
                      <button
                        type="button"
                        onClick={() => setSort({ key: c.key, dir: active ? (sort.dir === 1 ? -1 : 1) : 1 })}
                        className={cn(
                          "inline-flex min-h-9 items-center gap-1.5 text-xs font-medium hover:text-cyan",
                          active ? "text-ink" : "text-ink-muted",
                        )}
                      >
                        {t(c.label)}
                        {active &&
                          (sort.dir === 1 ? <ArrowDown aria-hidden className="size-3" /> : <ArrowUp aria-hidden className="size-3" />)}
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-ink-muted">
                  {t("centres.col.trend")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, index) => (
                <motion.tr
                  key={r.facilityId}
                  layout={reduceMotion ? false : "position"}
                  initial={reduceMotion ? false : { opacity: 0.5, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.25,
                    delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.25),
                    layout: { duration: 0.25, delay: 0 },
                  }}
                  className="group transition-colors hover:bg-sky/60 focus-within:bg-sky/60 [&>td]:px-4 [&>td]:py-4"
                >
                  <th scope="row" className="px-4 py-4 text-left font-normal">
                    <Link href={`/facilities/${r.facilityId}`} className="flex min-h-11 items-center gap-3 rounded-sm">
                      <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: SEVERITY_META[r.status].hex }} />
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:text-cyan group-focus-within:text-cyan">{r.name}</span>
                        <span className="text-xs text-ink-muted">
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
                    <Ratio
                      value={r.doctorsPresent}
                      total={r.doctorsRostered}
                      warn={r.doctorsPresent / Math.max(1, r.doctorsRostered) < 0.75}
                    />
                  </td>
                  <td className="tabular px-2 py-3 text-center">
                    <span
                      className={cn(
                        "inline-grid size-7 place-items-center rounded-full text-xs font-medium",
                        r.medicinesAtRisk ? "bg-alert-soft text-alert-ink" : "text-ink-subtle",
                      )}
                    >
                      {r.medicinesAtRisk}
                    </span>
                  </td>
                  <td className="tabular px-2 py-3 text-center">
                    <span
                      className={cn(
                        "inline-grid size-7 place-items-center rounded-full text-xs font-medium",
                        r.testsDown ? "bg-watch-soft text-watch-ink" : "text-ink-subtle",
                      )}
                    >
                      {r.testsDown}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <Sparkline values={r.footfall} stroke={SEVERITY_META[r.status].hex} width={110} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-12 text-center text-sm text-ink-muted">{t("directory.empty")}</p>}
        </div>
      </section>
    </div>
  );
}
