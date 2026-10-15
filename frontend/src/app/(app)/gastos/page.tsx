import type { Metadata } from "next";

import { TransactionsPage } from "@/components/finance/TransactionsPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Gastos") };
}

export default function Page() {
  return <TransactionsPage />;
}
