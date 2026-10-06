import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/app/SectionPlaceholder";

export const metadata: Metadata = { title: "Gastos fijos" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Gastos fijos"
      description="Aquí podrás administrar tus gastos fijos y sus fechas de pago."
    />
  );
}
