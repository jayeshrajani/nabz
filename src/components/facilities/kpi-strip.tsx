import { BedDouble, Building2, FlaskConical, OctagonAlert, Pill, Stethoscope, Users } from "lucide-react";
import type { DistrictSummary } from "@/domain/district";

const nf = new Intl.NumberFormat("en-IN");

export function KpiStrip({ summary }: { summary: DistrictSummary }) {
  const bedsFree = summary.bedsTotal - summary.bedsOccupied;
  const items = [
    { label: "Facilities", value: nf.format(summary.facilities), hint: `${summary.warning} on watch`, icon: Building2 },
    { label: "Critical", value: nf.format(summary.critical), hint: "need attention now", icon: OctagonAlert, tone: summary.critical > 0 ? "text-signal-red" : undefined },
    { label: "Stock-out risks", value: nf.format(summary.stockOutRisks), hint: "cover < lead time", icon: Pill, tone: summary.stockOutRisks > 0 ? "text-signal-red" : undefined },
    { label: "Beds free", value: nf.format(bedsFree), hint: `${nf.format(summary.bedsOccupied)} of ${nf.format(summary.bedsTotal)} occupied`, icon: BedDouble },
    { label: "Footfall today", value: nf.format(summary.footfallToday), hint: "recorded arrivals", icon: Users },
    { label: "Doctor gap", value: nf.format(summary.doctorGap), hint: "absent vs scheduled", icon: Stethoscope, tone: summary.doctorGap > 0 ? "text-signal-amber" : undefined },
    { label: "Test shortages", value: nf.format(summary.diagnosticShortages), hint: "tests unavailable", icon: FlaskConical, tone: summary.diagnosticShortages > 0 ? "text-signal-amber" : undefined },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-4 xl:grid-cols-7">
      {items.map(({ label, value, hint, icon: Icon, tone }) => (
        <div key={label} className="flex flex-col gap-1 bg-ink-900 px-4 py-3.5">
          <dt className="flex items-center gap-1.5 text-[11px] tracking-wide text-fg-subtle uppercase">
            <Icon aria-hidden className="size-3.5" />
            {label}
          </dt>
          <dd className={`tabular text-2xl font-semibold tracking-tight ${tone ?? "text-fg"}`}>{value}</dd>
          <dd className="text-[11px] text-fg-subtle">{hint}</dd>
        </div>
      ))}
    </dl>
  );
}
