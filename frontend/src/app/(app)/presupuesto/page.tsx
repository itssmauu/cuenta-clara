import type { Metadata } from "next";

import { BudgetPage } from "@/components/finance/BudgetPage";

export const metadata: Metadata = { title: "Presupuesto" };

export default function Page() {
  return <BudgetPage />;
}
