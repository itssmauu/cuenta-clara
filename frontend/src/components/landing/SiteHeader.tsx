import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

const sections = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#prediccion", label: "Predicción" },
  { href: "#seguridad", label: "Seguridad" },
];

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Logo />
      {/* Section links are a desktop convenience; on phones the page is a single scroll */}
      <nav aria-label="Secciones" className="hidden md:block">
        <ul className="flex gap-7 text-[15px] font-semibold">
          {sections.map((section) => (
            <li key={section.href}>
              <a
                href={section.href}
                className="hover:text-primary inline-flex min-h-11 items-center transition-colors duration-200"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/login" className={buttonClass("ghost", "md", "hover:scale-[1.04]")}>
          Iniciar sesión
        </Link>
        <Link href="/register" className={buttonClass("accent", "md", "hover:scale-[1.04]")}>
          Crear cuenta
        </Link>
      </div>
    </header>
  );
}
