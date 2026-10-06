import type { Metadata } from "next";

import { IncomesPage } from "@/components/finance/IncomesPage";

export const metadata: Metadata = { title: "Ingresos" };

export default function Page() {
  return <IncomesPage />;
}
