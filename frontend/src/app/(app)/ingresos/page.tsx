import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/app/SectionPlaceholder";

export const metadata: Metadata = { title: "Ingresos" };

export default function Page() {
  return (
    <SectionPlaceholder
      title="Ingresos"
      description="Aquí podrás ver, editar y pausar tus ingresos recurrentes."
    />
  );
}
