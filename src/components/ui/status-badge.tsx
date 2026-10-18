import { OctagonAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Severity } from "@/domain/risk";
import { cn } from "@/lib/utils";

export const SEVERITY_META: Record<Severity, { label: string; text: string; bg: string; hex: string }> = {
  healthy: { label: "Stable", text: "text-signal-teal", bg: "bg-signal-teal/10 border-signal-teal/25", hex: "#34d1b0" },
  warning: { label: "Watch", text: "text-signal-amber", bg: "bg-signal-amber/10 border-signal-amber/25", hex: "#f3b54a" },
  critical: { label: "Critical", text: "text-signal-red", bg: "bg-signal-red/10 border-signal-red/30", hex: "#f2626a" },
};

const ICONS = { healthy: ShieldCheck, warning: TriangleAlert, critical: OctagonAlert } as const;

export function StatusBadge({ severity, className }: { severity: Severity; className?: string }) {
  const meta = SEVERITY_META[severity];
  const Icon = ICONS[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        meta.bg,
        meta.text,
        className,
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}
