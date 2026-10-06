import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/app/SectionPlaceholder";

export const metadata: Metadata = { title: "Predicción" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Predicción"
      description="Aquí verás tu saldo proyectado para los próximos periodos."
    />
  );
}
