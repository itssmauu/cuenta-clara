import type { Metadata } from "next";

import { AccountsPage } from "@/components/finance/AccountsPage";

export const metadata: Metadata = { title: "Cuentas" };

export default function Page() {
  return <AccountsPage />;
}
