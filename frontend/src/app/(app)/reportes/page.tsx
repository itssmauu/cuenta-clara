import type { Metadata } from "next";

import { ReportsPage } from "@/components/finance/ReportsPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Reportes") };
}

export default function Page() {
  return <ReportsPage />;
}
