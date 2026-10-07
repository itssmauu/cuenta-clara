import { ArrowUpRight, Sparkles } from "lucide-react";

/*
 * Illustrative projection for the sign-in panel. Every figure is the product's worked
 * example (100 − 30 + 160 = 230, then +130 a week), labelled "Ejemplo": nothing here
 * pretends to be the visitor's data. Pure SVG + CSS: no JavaScript, so it renders on
 * the server under the nonce-based CSP, and every looping motion stops with
 * prefers-reduced-motion.
 */

// x: Hoy, Sem 1…4 · y: 150 − value / 520 × 135 (so $100 → 124 and $490 → 22.8)
const LINE =
  "M20 124 C60 124 60 90.3 100 90.3 S140 56.5 180 56.5 S220 22.8 260 22.8 S300 43.6 340 43.6";
// The estimate widens the further it looks ahead
const BAND =
  "M20 124 C60 124 60 84.3 100 84.3 S140 44.5 180 44.5 S220 4.8 260 4.8 S300 19.6 340 19.6 " +
  "L340 67.6 C300 67.6 300 40.8 260 40.8 S220 68.5 180 68.5 S140 96.3 100 96.3 S60 124 20 124 Z";
const AREA = `${LINE} L340 150 L20 150 Z`;
const TICKS = [
  { x: 20, label: "Hoy" },
  { x: 100, label: "Sem 1" },
  { x: 180, label: "Sem 2" },
  { x: 260, label: "Sem 3" },
  { x: 340, label: "Sem 4" },
];

// Background "live data" bars: static heights (the CSP blocks inline styles)
const BARS = [
  "h-[38%] [--d:0ms]",
  "h-[52%] [--d:60ms]",
  "h-[44%] [--d:120ms]",
  "h-[66%] [--d:180ms]",
  "h-[58%] [--d:240ms]",
  "h-[74%] [--d:300ms]",
  "h-[62%] [--d:360ms]",
  "h-[84%] [--d:420ms]",
  "h-[70%] [--d:480ms]",
  "h-[92%] [--d:540ms]",
  "h-[78%] [--d:600ms]",
  "h-[100%] [--d:660ms]",
];

/** Faint bars that rise behind the panel's message and keep gently moving. */
export function LiveBars() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-6 bottom-0 -z-10 flex h-[58%] items-end gap-2 [mask-image:linear-gradient(to_top,black_0%,transparent_80%)] sm:inset-x-10 sm:gap-3"
    >
      {BARS.map((bar) => (
        <span key={bar} className={`live-bar bg-primary/15 flex-1 rounded-t-xl ${bar}`} />
      ))}
    </div>
  );
}

export function AuthShowcase() {
  return (
    <div aria-hidden="true" className="relative mx-auto hidden w-full max-w-[440px] md:block">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 pb-12 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-on-ink flex items-center gap-1.5 text-xs font-bold">
              <Sparkles className="text-accent size-3.5" />
              Saldo proyectado · semana 3
            </span>
            <span className="font-display text-[40px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
              $<span className="count-up [--to:490]" />
            </span>
          </div>
          <span className="text-on-ink rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold">
            Ejemplo
          </span>
        </div>

        <div className="chart-draw mt-4">
          <svg viewBox="0 0 360 172" className="h-auto w-full overflow-visible">
            <defs>
              <linearGradient id="auth-area" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  className="[stop-color:var(--color-primary)] [stop-opacity:0.55]"
                />
                <stop
                  offset="100%"
                  className="[stop-color:var(--color-primary)] [stop-opacity:0]"
                />
              </linearGradient>
            </defs>

            {[40, 80, 120].map((y) => (
              <line
                key={y}
                x1="0"
                x2="360"
                y1={y}
                y2={y}
                className="stroke-white/10 [stroke-dasharray:3_5]"
              />
            ))}

            <path d={AREA} fill="url(#auth-area)" />
            <path d={BAND} className="band-breathe fill-white/10" />
            <path
              d={LINE}
              fill="none"
              className="stroke-accent [stroke-width:3] [stroke-dasharray:7_6] [stroke-linecap:round]"
            />

            {/* Peak of the example: week 3, $490 */}
            <circle cx="260" cy="22.8" r="5" className="fill-accent stroke-ink [stroke-width:3]" />

            {/* A spark that keeps travelling along the prediction */}
            <circle r="4" className="motion-only fill-white">
              <animateMotion dur="3.6s" begin="1.8s" repeatCount="indefinite" path={LINE} />
            </circle>

            {/* Today: a live marker */}
            <line
              x1="20"
              x2="20"
              y1="10"
              y2="150"
              className="stroke-white/20 [stroke-dasharray:2_4]"
            />
            <circle cx="20" cy="124" r="5" className="pulse-ring fill-mint/60" />
            <circle cx="20" cy="124" r="5" className="fill-mint stroke-ink [stroke-width:3]" />

            {TICKS.map((tick) => (
              <text
                key={tick.label}
                x={tick.x}
                y="168"
                textAnchor="middle"
                className="fill-on-ink-muted text-[11px] font-bold"
              >
                {tick.label}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Floating chips: the inputs behind the projection */}
      <div className="float-slow absolute -top-12 -right-4 flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)]">
        <span className="bg-mint-tint text-mint-ink grid size-8 place-items-center rounded-xl">
          <ArrowUpRight className="size-4" strokeWidth={3} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-muted text-[11px] font-bold">Ingreso semanal</span>
          <span className="text-ink text-sm font-extrabold tabular-nums">
            +$
            <span className="count-up [--to:160]" />
          </span>
        </span>
      </div>

      <div className="float-slower absolute -bottom-9 -left-5 flex w-[190px] flex-col gap-2 rounded-2xl bg-white px-3.5 py-3 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)]">
        <span className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-muted">Límite usado</span>
          <span className="text-ink tabular-nums">
            <span className="count-up [--to:72]" />%
          </span>
        </span>
        <span className="bg-canvas h-2 overflow-hidden rounded-full">
          <span className="chart-draw bg-mint-ink block h-full w-[72%] rounded-full" />
        </span>
      </div>
    </div>
  );
}
