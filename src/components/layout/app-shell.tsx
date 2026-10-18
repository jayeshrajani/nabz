import type { ReactNode } from "react";
import { BRAND } from "@/config/brand";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-8">
          <a href="#main" className="text-lg font-semibold tracking-tight text-ink">
            {BRAND.name}
            <span className="text-brand">.</span>
          </a>
          <span className="rounded-full bg-watch-soft px-2.5 py-1 text-xs font-medium text-watch-ink">Sample data</span>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1400px] px-4 pt-8 pb-16 sm:px-8">
        {children}
      </main>
    </div>
  );
}
