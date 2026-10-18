import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bento tile with a mono eyebrow, in a light or dark finish. */
export function Tile({
  icon: Icon,
  label,
  tone = "light",
  aside,
  className,
  children,
  labelledBy,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "light" | "dark";
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  const dark = tone === "dark";
  return (
    <section
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-lg p-5 sm:p-6",
        dark ? "bg-forest text-white" : "border border-line bg-surface text-ink",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className={cn("flex items-center gap-2.5 text-sm font-medium", dark ? "text-white/80" : "text-ink-muted")}>
          <Icon aria-hidden className={cn("size-4", dark ? "text-citron" : "text-cyan")} strokeWidth={1.75} />
          {label}
        </p>
        {aside}
      </div>
      {children}
    </section>
  );
}
