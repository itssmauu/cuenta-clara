import type { Metadata } from "next";
import { Suspense } from "react";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Dashboard") };
}

export default function DashboardPage() {
  return (
    // Dashboard reads the selected period from the URL (useSearchParams)
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
