import type { Metadata } from "next";
import { Suspense } from "react";

import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    // Dashboard reads the selected period from the URL (useSearchParams)
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
