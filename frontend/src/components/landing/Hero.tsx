import Link from "next/link";

import { buttonClass } from "@/components/ui/button";

import { HeroTilt } from "./HeroTilt";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-ink rounded-panel relative isolate flex flex-wrap items-center gap-12 overflow-hidden p-8 text-white sm:p-12 lg:p-16"
    >
      {/* Depth: two soft glows in the brand colors and a faint grid, all decorative */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-primary/45 absolute -top-48 -right-32 size-[560px] rounded-full blur-[120px]" />
        <div className="bg-accent/20 absolute -bottom-56 left-1/4 size-[420px] rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] bg-[size:48px_48px]" />
      </div>

      <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-7">
        <p className="bg-ink-2 animate-fade-up self-start rounded-full px-4 py-2 text-sm font-semibold">
          Finanzas personales, semana a semana
        </p>
        <h1
          id="hero-title"
          className="font-display [animation:blur-up_900ms_var(--ease-out-strong)_80ms_both] text-[40px] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance sm:text-[56px] lg:text-[68px]"
        >
          Sabe cuánto te queda <span className="text-accent">antes de gastarlo.</span>
        </h1>
        <p className="text-on-ink animate-fade-up max-w-[520px] text-lg leading-relaxed [animation-delay:160ms]">
          Registra tu monto inicial, tus gastos fijos y tus ingresos. Cuenta Clara proyecta tu
          semana y te muestra a dónde va cada dólar.
        </p>
        <div className="animate-fade-up flex flex-wrap items-center gap-3.5 [animation-delay:240ms]">
          <Link
            href="/register"
            className={buttonClass("accent", "lg", "font-extrabold hover:scale-[1.04]")}
          >
            Empezar gratis
          </Link>
          <a
            href="#como-funciona"
            className={buttonClass("outline-on-ink", "lg", "hover:scale-[1.04]")}
          >
            Ver cómo funciona
          </a>
        </div>
      </div>

      <div className="animate-fade-up flex min-w-0 flex-[1_1_320px] justify-center [animation-delay:200ms]">
        {/* Float (CSS, off the main thread) outside, cursor tilt (spring) inside */}
        <div className="motion-safe:animate-float">
          <HeroTilt>
            <PhoneMockup />
          </HeroTilt>
        </div>
      </div>
    </section>
  );
}

/** Illustrative app preview. Every figure is the worked example, labelled as such. */
function PhoneMockup() {
  return (
    <figure
      aria-label="Vista previa de la app con un ejemplo: monto inicial de 100 dólares, gastos de 30 e ingreso de 160 dan un saldo de 230."
      className="bg-ink-deep border-ink-2 flex w-[290px] flex-col gap-3.5 rounded-[44px] border-[3px] p-[18px] shadow-[0_40px_80px_-24px_rgb(0_0_0/0.6)]"
    >
      <div aria-hidden="true" className="text-on-ink flex items-center justify-between text-[13px]">
        <span>Hola, [Nombre]</span>
        <span className="bg-ink-2 size-7 rounded-full" />
      </div>
      <div
        aria-hidden="true"
        className="text-ink flex flex-col gap-1 rounded-3xl bg-white p-[18px]"
      >
        <span className="text-muted text-xs font-semibold">Saldo disponible (ejemplo)</span>
        <span className="font-display text-4xl font-extrabold tracking-[-0.02em]">$230.00</span>
        <span className="text-mint-ink text-xs font-bold">+$160 esta semana</span>
      </div>
      <div aria-hidden="true" className="bg-ink-3 flex gap-1.5 rounded-full p-1 text-xs font-bold">
        <span className="text-ink flex-1 rounded-full bg-white py-2 text-center">Ingresos</span>
        <span className="text-on-ink flex-1 py-2 text-center">Gastos</span>
      </div>
      <dl aria-hidden="true" className="flex flex-col gap-2.5 text-[13px]">
        <MockRow label="Monto inicial" value="$100" />
        <MockRow label="Gastos de la semana" value="−$30" valueClass="text-accent" />
        <MockRow label="Ingreso semanal" value="+$160" valueClass="text-mint" />
      </dl>
    </figure>
  );
}

function MockRow({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-ink-3 flex justify-between rounded-[18px] p-3.5">
      <dt>{label}</dt>
      <dd className={`font-bold ${valueClass}`}>{value}</dd>
    </div>
  );
}
