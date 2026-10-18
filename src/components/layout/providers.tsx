"use client";

import type { ReactNode } from "react";
import { AssistantProvider } from "@/features/assistant/assistant-context";
import { AssistantDrawer } from "@/features/assistant/assistant-drawer";
import { DistrictProvider } from "@/features/district/use-district";
import { I18nProvider } from "@/i18n/provider";
import { AppShell } from "./app-shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <DistrictProvider>
        <AssistantProvider>
          <AppShell>{children}</AppShell>
          <AssistantDrawer />
        </AssistantProvider>
      </DistrictProvider>
    </I18nProvider>
  );
}
