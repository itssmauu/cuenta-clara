import type { Metadata } from "next";

import { SettingsPage } from "@/components/finance/SettingsPage";

export const metadata: Metadata = { title: "Configuración" };

export default function Page() {
  return <SettingsPage />;
}
