import type { DistrictSummary } from "@/domain/district";

const nf = new Intl.NumberFormat("en-IN");

export function KpiStrip({ summary }: { summary: DistrictSummary }) {
  const needAttention = summary.critical + summary.warning;
  const bedsFree = summary.bedsTotal - summary.bedsOccupied;
  const items = [
    { label: "Centres needing attention", value: needAttention, of: summary.facilities, tone: needAttention ? "text-alert-ink" : "text-ink" },
    { label: "Medicines may run out", value: summary.stockOutRisks, tone: summary.stockOutRisks ? "text-alert-ink" : "text-ink" },
    { label: "Beds free", value: bedsFree, of: summary.bedsTotal, tone: "text-ink" },
    { label: "Doctors absent today", value: summary.doctorGap, tone: summary.doctorGap ? "text-watch-ink" : "text-ink" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, of, tone }) => (
        <div key={label} className="card px-5 py-4">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="tabular mt-1 flex items-baseline gap-1.5">
            <span className={`text-3xl font-semibold tracking-tight ${tone}`}>{nf.format(value)}</span>
            {of !== undefined && <span className="text-sm text-ink-subtle">of {nf.format(of)}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
