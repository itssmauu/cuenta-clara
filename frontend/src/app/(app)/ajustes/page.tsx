import type { Metadata } from "next";

import { SettingsPage } from "@/components/finance/SettingsPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Configuración") };
}

export default function Page() {
  return <SettingsPage />;
}
