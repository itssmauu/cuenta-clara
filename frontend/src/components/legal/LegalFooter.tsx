"use client";

import Link from "next/link";

import { useT } from "@/i18n/client";
import { LEGAL, LEGAL_PAGES } from "@/lib/legal";

/** Links to the legal documents, shown on every public page and inside the app. */
export function LegalLinks({
  className = "",
  compact = false,
  linkClassName = "hover:text-ink",
}: {
  className?: string;
  /** Short labels, for tight spots such as the app sidebar */
  compact?: boolean;
  linkClassName?: string;
}) {
  const t = useT();
  return (
    <nav aria-label={t("Información legal")} className={className}>
      <ul className={`flex flex-wrap ${compact ? "gap-x-3" : "gap-x-5"} gap-y-1`}>
        {LEGAL_PAGES.map((page) => (
          <li key={page.href}>
            <Link href={page.href} className={`inline-flex min-h-11 items-center ${linkClassName}`}>
              {t(compact ? page.short : page.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LegalFooter() {
  const t = useT();
  return (
    <footer className="text-muted flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-6 text-sm font-semibold">
      <p>
        {t("© {year} {service} · Hecho en Panamá", {
          year: new Date().getFullYear(),
          service: LEGAL.service,
        })}
      </p>
      <LegalLinks />
    </footer>
  );
}
