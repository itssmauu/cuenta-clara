import type { Metadata } from "next";

import { GoalsPage } from "@/components/finance/GoalsPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Metas de ahorro") };
}

export default function Page() {
  return <GoalsPage />;
}
