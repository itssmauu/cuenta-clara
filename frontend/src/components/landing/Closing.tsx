import Link from "next/link";

import { buttonClass } from "@/components/ui/button";

export function Testimonial() {
  return (
    <figure data-reveal className="flex flex-wrap items-center gap-8 sm:px-10">
      <span aria-hidden="true" className="bg-accent size-[72px] shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
        {/* Placeholder until there is a real, consented user testimonial */}
        <blockquote className="font-display text-xl leading-snug font-semibold sm:text-[26px]">
          “[Testimonio de un usuario real: qué problema le resolvió la app].”
        </blockquote>
        <figcaption className="text-muted text-[15px] font-bold">[Nombre], [ocupación]</figcaption>
      </div>
    </figure>
  );
}

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      data-reveal
      className="bg-primary rounded-panel relative isolate flex flex-wrap items-center justify-between gap-8 overflow-hidden p-8 text-white sm:p-16"
    >
      <div
        aria-hidden="true"
        className="bg-accent/35 pointer-events-none absolute -top-40 -right-24 -z-10 size-[420px] rounded-full blur-[110px]"
      />
      <h2
        id="cta-title"
        className="font-display min-w-0 flex-[1_1_420px] text-[32px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-[44px]"
      >
        Empieza hoy y ordena tu próxima semana.
      </h2>
      <Link
        href="/register"
        className={buttonClass("accent", "lg", "text-[17px] font-extrabold hover:scale-[1.04]")}
      >
        Crear mi cuenta
      </Link>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="text-muted flex flex-wrap justify-between gap-4 pb-10 text-sm font-semibold">
      <p>© {new Date().getFullYear()} Cuenta Clara · Proyecto de portafolio</p>
      <a href="#top" className="hover:text-ink inline-flex min-h-11 items-center">
        Volver arriba
      </a>
    </footer>
  );
}
