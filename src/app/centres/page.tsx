import type { Metadata } from "next";
import { CentresView } from "@/features/district/centres-view";

export const metadata: Metadata = { title: "Centres" };

export default function CentresPage() {
  return <CentresView />;
}
