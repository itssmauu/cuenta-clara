import { Construction } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";

import { PageHeader } from "./PageHeader";

/** Empty state for sections that are still being built. */
export function SectionPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <section className="rounded-panel flex flex-col items-start gap-4 bg-white p-8 sm:p-12">
        <Construction aria-hidden="true" className="text-primary size-10" />
        <h2 className="font-display text-xl font-bold">Esta sección está en construcción</h2>
        <p className="text-body max-w-prose leading-relaxed">{description}</p>
        <Link href="/dashboard" className={buttonClass("ink")}>
          Volver al dashboard
        </Link>
      </section>
    </>
  );
}
