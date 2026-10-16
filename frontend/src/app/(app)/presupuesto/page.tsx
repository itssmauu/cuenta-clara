import type { Metadata } from "next";

import { BudgetPage } from "@/components/finance/BudgetPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Presupuesto") };
}

export default function Page() {
  return <BudgetPage />;
}
