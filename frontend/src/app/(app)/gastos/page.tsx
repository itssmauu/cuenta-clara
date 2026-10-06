import type { Metadata } from "next";

import { TransactionsPage } from "@/components/finance/TransactionsPage";

export const metadata: Metadata = { title: "Gastos" };

export default function Page() {
  return <TransactionsPage />;
}
