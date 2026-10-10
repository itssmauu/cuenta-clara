import Link from "next/link";
import type { ReactNode } from "react";

import { LEGAL, LEGAL_PAGES } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * A legal document that people can actually read: a plain-language summary first,
 * then numbered sections with an index, the version and the date it applies from.
 */
export function LegalDocument({
  title,
  current,
  summary,
  sections,
}: {
  title: string;
  /** Its own path, to mark it in the list of documents */
  current: (typeof LEGAL_PAGES)[number]["href"];
  summary: string[];
  sections: LegalSection[];
}) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:w-64 lg:shrink-0">
        <nav aria-label="Documentos legales" className="flex flex-col gap-1">
          {LEGAL_PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              aria-current={page.href === current ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-2xl px-4 text-sm font-bold transition-colors duration-200 ${
                page.href === current ? "bg-ink text-white" : "text-body hover:bg-white"
              }`}
            >
              {page.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="En esta página" className="hidden flex-col gap-1 lg:flex">
          <p className="text-muted px-4 pb-1 text-xs font-bold tracking-[0.08em]">EN ESTA PÁGINA</p>
          {sections.map((section, index) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="text-body hover:text-ink px-4 py-1.5 text-[13px] font-semibold transition-colors duration-200"
            >
              {index + 1}. {section.title}
            </a>
          ))}
        </nav>
      </aside>

      <article className="flex min-w-0 flex-1 flex-col gap-8 rounded-[32px] bg-white p-6 sm:p-10">
        <header className="flex flex-col gap-3">
          <p className="text-primary text-xs font-bold tracking-[0.08em]">
            LEGAL · {LEGAL.service.toUpperCase()}
          </p>
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.02em] sm:text-[40px]">
            {title}
          </h1>
          <p className="text-muted text-sm font-semibold">
            Vigente desde el {LEGAL.updatedOn} · versión {LEGAL.version}
          </p>
        </header>

        <section
          aria-labelledby="summary-title"
          className="bg-primary-tint text-on-tint flex flex-col gap-3 rounded-3xl p-5 sm:p-6"
        >
          <h2 id="summary-title" className="font-display text-ink text-lg font-bold">
            En resumen
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed">
            {summary.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="text-[13px]">
            El resumen ayuda a entender lo esencial; lo que obliga es el texto completo de abajo.
          </p>
        </section>

        {sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
            className="text-body [&_a]:text-primary [&_h3]:text-ink [&_strong]:text-ink [&_td]:border-line [&_th]:text-muted flex scroll-mt-6 flex-col gap-3 text-[15px] leading-relaxed [&_a]:font-bold [&_a:hover]:underline [&_h3]:font-bold [&_li]:pl-1 [&_table]:w-full [&_td]:border-t [&_td]:py-2.5 [&_td]:pr-3 [&_td]:align-top [&_th]:pr-3 [&_th]:pb-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5"
          >
            <h2 id={`${section.id}-title`} className="font-display text-ink text-xl font-bold">
              {index + 1}. {section.title}
            </h2>
            {section.body}
          </section>
        ))}
      </article>
    </div>
  );
}

/** How to reach the person responsible: the configured email and, always, the in-app tools. */
export function PrivacyContact() {
  return (
    <>
      {LEGAL.contactEmail ? (
        <p>
          Correo de contacto para privacidad:{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
      ) : null}
      <p>
        Dentro de tu cuenta, en <strong>Configuración › Privacidad y datos</strong>, puedes en
        cualquier momento descargar una copia de tus datos, desactivar a Balbo o eliminar tu cuenta,
        sin tener que escribirnos.
      </p>
    </>
  );
}
