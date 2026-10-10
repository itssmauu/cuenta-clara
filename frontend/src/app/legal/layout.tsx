import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LegalFooter } from "@/components/legal/LegalFooter";
import { Logo } from "@/components/ui/Logo";

export default function LegalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col gap-8 px-4 py-6 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" aria-label="Cuenta Clara, ir al inicio">
          <Logo />
        </Link>
        <Link
          href="/"
          className="text-body hover:text-ink inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver al inicio
        </Link>
      </header>
      <main id="contenido" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <LegalFooter />
    </div>
  );
}
