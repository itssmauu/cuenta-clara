import type { Metadata } from "next";

import { ReportsPage } from "@/components/finance/ReportsPage";

export const metadata: Metadata = { title: "Reportes" };

export default function Page() {
  return <ReportsPage />;
}
