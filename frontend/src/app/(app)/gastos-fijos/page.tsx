import type { Metadata } from "next";

import { FixedExpensesPage } from "@/components/finance/FixedExpensesPage";

export const metadata: Metadata = { title: "Gastos fijos" };

export default function Page() {
  return <FixedExpensesPage />;
}
