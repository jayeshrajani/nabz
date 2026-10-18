import { AppShell } from "@/components/layout/app-shell";
import { CommandCentre } from "@/features/district/command-centre";

export default function Home() {
  return (
    <AppShell>
      <CommandCentre />
    </AppShell>
  );
}
