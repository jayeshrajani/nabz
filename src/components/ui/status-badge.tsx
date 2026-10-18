import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { Severity } from "@/domain/risk";
import { cn } from "@/lib/utils";

export const SEVERITY_META: Record<Severity, { label: string; ink: string; soft: string; hex: string }> = {
  healthy: { label: "Steady", ink: "text-ok-ink", soft: "bg-ok-soft", hex: "#2f9e76" },
  warning: { label: "Watch", ink: "text-watch-ink", soft: "bg-watch-soft", hex: "#f0ad32" },
  critical: { label: "Urgent", ink: "text-alert-ink", soft: "bg-alert-soft", hex: "#ef5f4f" },
};

const ICONS = { healthy: CircleCheck, warning: TriangleAlert, critical: CircleAlert } as const;

export function StatusBadge({ severity, className }: { severity: Severity; className?: string }) {
  const meta = SEVERITY_META[severity];
  const Icon = ICONS[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", meta.soft, meta.ink, className)}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}
