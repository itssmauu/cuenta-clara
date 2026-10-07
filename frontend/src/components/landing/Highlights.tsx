import {
  ArrowDownRight,
  BellRing,
  CalendarRange,
  FileDown,
  LockKeyhole,
  PieChart,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { CountUp } from "./CountUp";
import { Marquee } from "./Marquee";

/*
 * "Te acompaña toda la semana": three small live demos of what the app does,
 * in place of a testimonial (there are no real users to quote yet). Every figure
 * is illustrative and labelled "Ejemplo"; the demos play once when scrolled into
 * view (ScrollReveal) and the feature band below loops only without reduced motion.
 */

function DemoCard({
  icon: Icon,
  title,
  text,
  delay,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  delay: string;
  children: ReactNode;
}) {
  return (
    <li
      data-reveal
      className={`rounded-card flex min-w-0 flex-col gap-5 bg-white p-6 sm:p-7 ${delay}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="bg-primary-tint text-primary grid size-11 place-items-center rounded-2xl">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="text-muted bg-canvas rounded-full px-2.5 py-1 text-[11px] font-bold">
          Ejemplo
        </span>
      </div>
      {/* The demo is illustrative: the title and text below carry the meaning */}
      <div
        aria-hidden="true"
        className="bg-canvas flex h-[164px] flex-col justify-center rounded-3xl p-5"
      >
        {children}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-xl leading-tight font-bold">{title}</h3>
        <p className="text-body text-[15px] leading-relaxed">{text}</p>
      </div>
    </li>
  );
}

/** A $40 weekly limit filling up to 80 %, then the warning pops in. */
function AlertDemo() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[13px] font-bold">
        <span>Límite semanal</span>
        <span className="tabular-nums">
          <CountUp value={80} delayMs={200} />%
        </span>
      </div>
      <span className="h-3 overflow-hidden rounded-full bg-white">
        <span className="reveal-grow-x bg-accent block h-full w-[80%] rounded-full delay-200" />
      </span>
      <span className="reveal-pop bg-ink flex items-center gap-2 self-start rounded-full py-2 pr-3.5 pl-2.5 text-xs font-bold text-white delay-[1100ms]">
        <BellRing className="text-accent size-4" />
        Atención: te quedan $8.00
      </span>
    </div>
  );
}

/** A $600 laptop goal at 60 %: the ring fills and the plan appears. */
function GoalDemo() {
  return (
    <div className="flex items-center gap-5">
      <div className="relative grid size-[96px] shrink-0 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r="15.5" className="fill-none stroke-white [stroke-width:4]" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            pathLength={100}
            className="reveal-ring stroke-primary fill-none [stroke-width:4] [--ring-offset:40] [stroke-linecap:round]"
          />
        </svg>
        <span className="font-display text-xl font-extrabold tabular-nums">
          <CountUp value={60} delayMs={200} />%
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-display text-lg font-bold">Laptop</span>
        <span className="text-muted text-[13px] font-semibold tabular-nums">
          <CountUp value={360} prefix="$" delayMs={200} /> de $600
        </span>
        <span className="reveal-slide-x text-mint-ink text-[13px] font-bold delay-[900ms]">
          Aparta $60 por semana
        </span>
      </div>
    </div>
  );
}

/** Weekly variable spending with its trend line: down $3.20 a week. */
function TrendDemo() {
  return (
    <div className="flex flex-col gap-3">
      <div className="reveal-grow-x delay-150">
        <svg viewBox="0 0 220 70" className="h-[72px] w-full overflow-visible">
          {/* Past weeks (solid) and the trend ahead (dashed) */}
          <polyline
            points="4,18 40,30 76,22 112,38 148,34"
            className="stroke-primary fill-none [stroke-width:3] [stroke-linecap:round] [stroke-linejoin:round]"
          />
          <line
            x1="148"
            y1="34"
            x2="216"
            y2="52"
            className="stroke-accent [stroke-width:3] [stroke-dasharray:5_5] [stroke-linecap:round]"
          />
          {[
            [4, 18],
            [40, 30],
            [76, 22],
            [112, 38],
            [148, 34],
          ].map(([x, y]) => (
            <circle
              key={x}
              cx={x}
              cy={y}
              r="3.5"
              className="fill-primary stroke-canvas [stroke-width:2]"
            />
          ))}
          <circle cx="216" cy="52" r="4" className="fill-accent stroke-canvas [stroke-width:2]" />
        </svg>
      </div>
      <span className="reveal-pop flex items-center gap-2 self-start rounded-full bg-white py-2 pr-3.5 pl-2.5 text-xs font-bold delay-[1000ms]">
        <ArrowDownRight className="text-mint-ink size-4" strokeWidth={3} />
        Tu gasto baja $3.20 por semana
      </span>
    </div>
  );
}

const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: BellRing, text: "Alerta al 80 % de tu límite" },
  { icon: Target, text: "Metas de ahorro con plan semanal" },
  { icon: Sparkles, text: "Predicción con tendencia" },
  { icon: CalendarRange, text: "Diario, semanal, quincenal o mensual" },
  { icon: PieChart, text: "Gasto por categoría" },
  { icon: TrendingDown, text: "Comparación con el periodo anterior" },
  { icon: FileDown, text: "Exporta tus datos a CSV" },
  { icon: LockKeyhole, text: "Contraseñas con Argon2id" },
  { icon: ShieldCheck, text: "Tus datos solo los ves tú" },
];

function FeatureList({ copy = false }: { copy?: boolean }) {
  return (
    <ul
      aria-hidden={copy || undefined}
      aria-label={copy ? undefined : "Lo que incluye Cuenta Clara"}
      className={`flex shrink-0 gap-3 pr-3 motion-reduce:shrink motion-reduce:flex-wrap ${copy ? "motion-reduce:hidden" : ""}`}
    >
      {FEATURES.map(({ icon: Icon, text }) => (
        <li
          key={text}
          className="flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold whitespace-nowrap"
        >
          <Icon aria-hidden="true" className="text-primary size-4" />
          {text}
        </li>
      ))}
    </ul>
  );
}

export function Highlights() {
  return (
    <section aria-labelledby="highlights-title" className="flex flex-col gap-10">
      <div data-reveal className="flex max-w-[640px] flex-col gap-4">
        <p className="text-primary text-sm font-bold tracking-[0.08em]">TU DÍA A DÍA</p>
        <h2
          id="highlights-title"
          className="font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-[52px]"
        >
          Te acompaña toda la semana.
        </h2>
        <p className="text-body text-[17px] leading-relaxed">
          No necesitas saber de finanzas. Cuenta Clara hace las cuentas por ti y te avisa justo
          cuando importa, para que decidas con calma.
        </p>
      </div>

      <ul className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
        <DemoCard
          icon={BellRing}
          title="Te avisa antes de pasarte"
          text="Al llegar al 80 % de tu límite te lo dice con palabras claras, no solo con colores."
          delay=""
        >
          <AlertDemo />
        </DemoCard>
        <DemoCard
          icon={Target}
          title="Ahorra para lo que quieres"
          text="Crea una meta y te decimos cuánto apartar cada semana para llegar a tiempo."
          delay="delay-100"
        >
          <GoalDemo />
        </DemoCard>
        <DemoCard
          icon={Sparkles}
          title="Mira hacia dónde vas"
          text="Proyectamos tu saldo con tu historial y te explicamos la tendencia en una frase."
          delay="delay-200"
        >
          <TrendDemo />
        </DemoCard>
      </ul>

      {/* Everything included, gliding past (the second copy makes the loop seamless) */}
      <Marquee>
        <FeatureList />
        <FeatureList copy />
      </Marquee>
    </section>
  );
}
