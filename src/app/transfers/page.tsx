import type { Metadata } from "next";
import { TransfersView } from "@/features/transfers/transfers-view";

export const metadata: Metadata = { title: "Transfers" };

export default function TransfersPage() {
  return <TransfersView />;
}
