import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/app/SectionPlaceholder";

export const metadata: Metadata = { title: "Gastos" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Gastos"
      description="Aquí verás todos tus movimientos con filtros por fecha, tipo y categoría."
    />
  );
}
