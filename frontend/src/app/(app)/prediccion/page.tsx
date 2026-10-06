import type { Metadata } from "next";

import { ForecastPage } from "@/components/finance/ForecastPage";

export const metadata: Metadata = { title: "Predicción" };

export default function Page() {
  return <ForecastPage />;
}
