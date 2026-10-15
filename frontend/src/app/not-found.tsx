import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Página no encontrada") };
}

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-8 px-4 py-6 sm:px-10">
      <header>
        <Logo />
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className="rounded-panel flex flex-col items-start gap-5 bg-white p-8 outline-none sm:p-12"
      >
        <p className="text-primary font-display text-5xl font-extrabold">404</p>
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">
          {t("No encontramos esta página")}
        </h1>
        <p className="text-body leading-relaxed">
          {t("Puede que el enlace esté mal escrito o que la página ya no exista.")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className={buttonClass("primary")}>
            {t("Ir al inicio")}
          </Link>
          <Link href="/dashboard" className={buttonClass("ghost")}>
            {t("Ir a mi dashboard")}
          </Link>
        </div>
      </main>
    </div>
  );
}
