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
        "relative flex flex-col overflow-hidden rounded-[26px] p-5 sm:p-6",
        dark ? "bg-forest text-white shadow-(--shadow-lift)" : "border border-line bg-surface shadow-(--shadow-card)",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className={cn("eyebrow flex items-center gap-2", dark ? "text-white/55" : "text-ink-subtle")}>
          <Icon aria-hidden className="size-3.5" strokeWidth={2} />
          {label}
        </p>
        {aside}
      </div>
      {children}
    </section>
  );
}
