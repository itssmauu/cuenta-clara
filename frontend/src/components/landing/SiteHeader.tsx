import Link from "next/link";

import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { getT } from "@/i18n/server";
import { msg } from "@/i18n/translate";

const sections = [
  { href: "#como-funciona", label: msg("Cómo funciona") },
  { href: "#prediccion", label: msg("Predicción") },
  { href: "#seguridad", label: msg("Seguridad") },
];

export async function SiteHeader() {
  const t = await getT();
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      {/* Phones: logo and language on one row, the two buttons on the next */}
      <div className="flex w-full items-center justify-between gap-3 lg:w-auto">
        <Logo />
        <div className="lg:hidden">
          <LanguageSwitcher />
        </div>
      </div>
      {/* Section links are a desktop convenience; on phones the page is a single scroll */}
      <nav aria-label={t("Secciones")} className="hidden lg:block">
        <ul className="flex gap-7 text-[15px] font-semibold">
          {sections.map((section) => (
            <li key={section.href}>
              <a
                href={section.href}
                className="hover:text-primary inline-flex min-h-11 items-center transition-colors duration-200"
              >
                {t(section.label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="hidden lg:block">
          <LanguageSwitcher />
        </div>
        <Link
          href="/login"
          className={buttonClass("ghost", "md", "flex-1 hover:scale-[1.04] sm:flex-none")}
        >
          {t("Iniciar sesión")}
        </Link>
        <Link
          href="/register"
          className={buttonClass("accent", "md", "flex-1 hover:scale-[1.04] sm:flex-none")}
        >
          {t("Crear cuenta")}
        </Link>
      </div>
    </header>
  );
}
