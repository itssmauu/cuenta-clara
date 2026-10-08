import type { Metadata } from "next";

import { GoalsPage } from "@/components/finance/GoalsPage";

export const metadata: Metadata = { title: "Metas de ahorro" };

export default function Page() {
  return <GoalsPage />;
}
