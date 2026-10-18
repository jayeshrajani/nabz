"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { SEVERITY_META } from "@/components/ui/status-badge";
import { Tile } from "@/components/ui/tile";
import type { DistrictView } from "@/domain/district";
import type { RiskDomain, Severity } from "@/domain/risk";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const DOMAINS: RiskDomain[] = ["medicine", "beds", "staffing", "diagnostics", "footfall"];
const RANK: Record<Severity, number> = { critical: 0, warning: 1, healthy: 2 };

/** One row per centre, one square per area of care, coloured by the worst signal in that area. */
export function StatusMatrix({ view, className }: { view: DistrictView; className?: string }) {
  const { t } = useI18n();
  const rows = [...view.facilities].sort((a, b) => RANK[a.assessment.status] - RANK[b.assessment.status] || a.facility.name.localeCompare(b.facility.name));
  const bars = view.footfallSeries;
  const max = Math.max(...view.footfallSeries, 1);

  return (
    <Tile icon={LayoutGrid} label={t("matrix.title")} className={className}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th scope="col" className="pb-2 font-normal">
              <span className="sr-only">{t("nav.centres")}</span>
            </th>
            {DOMAINS.map((d) => (
              <th key={d} scope="col" className="eyebrow w-10 pb-2 text-center font-normal text-ink-subtle sm:w-16">
                <span className="hidden sm:inline">{t(`domain.${d}`)}</span>
                <span className="sm:hidden" aria-label={t(`domain.${d}`)}>
                  {t(`domain.${d}`).slice(0, 1)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ facility, assessment }) => {
            const worst = new Map<RiskDomain, Severity>();
            for (const s of assessment.signals) {
              const prev = worst.get(s.domain);
              if (!prev || RANK[s.severity] < RANK[prev]) worst.set(s.domain, s.severity);
            }
            return (
              <tr key={facility.id} className="group">
                <th scope="row" className="py-[3px] pr-3 text-left font-normal">
                  <Link
                    href={`/facilities/${facility.id}`}
                    className={cn("truncate transition-colors group-hover:text-brand", assessment.status === "healthy" ? "text-ink-muted" : SEVERITY_META[assessment.status].ink)}
                  >
                    {facility.name}
                  </Link>
                </th>
                {DOMAINS.map((d) => {
                  const sev = worst.get(d) ?? "healthy";
                  return (
                    <td key={d} className="py-[3px] text-center">
                      <span
                        role="img"
                        aria-label={`${t(`domain.${d}`)}: ${t(`status.${sev}`)}`}
                        title={`${t(`domain.${d}`)}: ${t(`status.${sev}`)}`}
                        className="inline-block h-4 w-7 rounded-md sm:w-10"
                        style={{ background: sev === "healthy" ? "#e2f3ea" : SEVERITY_META[sev].hex }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-auto pt-5">
        <p className="mb-2 flex justify-between font-mono text-[10px] text-ink-subtle">
          <span>{t("matrix.footfall", { days: bars.length })}</span>
          <span className="flex gap-3">
            {(["healthy", "warning", "critical"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span aria-hidden className="size-2 rounded-sm" style={{ background: SEVERITY_META[s].hex }} />
                {t(`status.${s}`)}
              </span>
            ))}
          </span>
        </p>
        <div aria-hidden className="flex h-14 items-end gap-[3px]">
          {bars.map((b, i) => (
            <span key={i} className={cn("flex-1 rounded-t-[3px]", i === bars.length - 1 ? "bg-forest" : "bg-mint/70")} style={{ height: `${Math.max(12, (b / max) * 100)}%` }} />
          ))}
        </div>
      </div>
    </Tile>
  );
}
