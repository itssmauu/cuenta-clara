import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/app/SectionPlaceholder";

export const metadata: Metadata = { title: "Configuración" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Configuración"
      description="Aquí podrás cambiar tu monto inicial, tu periodo de ingreso y tu límite de gasto."
    />
  );
}
