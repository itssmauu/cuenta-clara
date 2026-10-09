import Link from "next/link";

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
  return (
    <nav aria-label="Información legal" className={className}>
      <ul className={`flex flex-wrap ${compact ? "gap-x-3" : "gap-x-5"} gap-y-1`}>
        {LEGAL_PAGES.map((page) => (
          <li key={page.href}>
            <Link href={page.href} className={`inline-flex min-h-11 items-center ${linkClassName}`}>
              {compact ? page.short : page.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LegalFooter() {
  return (
    <footer className="text-muted flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-6 text-sm font-semibold">
      <p>
        © {new Date().getFullYear()} {LEGAL.service} · Responsable: {LEGAL.owner}, {LEGAL.country}
      </p>
      <LegalLinks />
    </footer>
  );
}
