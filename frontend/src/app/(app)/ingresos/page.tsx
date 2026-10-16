import type { Metadata } from "next";

import { IncomesPage } from "@/components/finance/IncomesPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Ingresos") };
}

export default function Page() {
  return <IncomesPage />;
}
