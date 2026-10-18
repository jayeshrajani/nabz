import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/config/brand";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-4 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">{BRAND.name}</span>
          <span className="hidden text-sm text-ink-subtle sm:inline">{BRAND.tagline}</span>
        </Link>
        <span className="eyebrow rounded-full border border-line-strong px-3 py-1 text-ink-muted">Sample district</span>
      </header>
      <main id="main" className="mx-auto max-w-[1360px] px-4 pb-20 sm:px-8">
        {children}
      </main>
    </div>
  );
}
