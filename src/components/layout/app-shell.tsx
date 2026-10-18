import { Activity, Radar } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/config/brand";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:flex-col lg:items-stretch lg:justify-start lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <div className="flex items-center gap-2.5 lg:px-2">
          <span className="grid size-8 place-items-center rounded-lg border border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan">
            <Radar aria-hidden className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">{BRAND.name}</p>
            <p className="hidden text-[11px] text-fg-subtle lg:block">{BRAND.tagline}</p>
          </div>
        </div>

        <nav aria-label="Primary" className="lg:mt-10">
          <ul className="flex gap-1 lg:flex-col">
            <li>
              <Link
                href="/"
                aria-current="page"
                className="flex items-center gap-2.5 rounded-lg bg-ink-800 px-3 py-2 text-sm text-fg"
              >
                <Activity aria-hidden className="size-4 text-signal-cyan" />
                Command Centre
              </Link>
            </li>
          </ul>
        </nav>

        <p className="mt-auto hidden rounded-lg border border-line px-3 py-2.5 text-[11px] leading-relaxed text-fg-subtle lg:block">
          Synthetic sandbox. Figures are fictional and isolated to your browser session.
        </p>
      </aside>

      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
