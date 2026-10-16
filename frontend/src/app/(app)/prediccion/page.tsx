import type { Metadata } from "next";

import { ForecastPage } from "@/components/finance/ForecastPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Predicción") };
}

export default function Page() {
  return <ForecastPage />;
}
