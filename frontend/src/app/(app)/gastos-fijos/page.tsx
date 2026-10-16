import type { Metadata } from "next";

import { FixedExpensesPage } from "@/components/finance/FixedExpensesPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Gastos fijos") };
}

export default function Page() {
  return <FixedExpensesPage />;
}
