import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

import { AuthShowcase, LiveBars } from "@/components/auth/AuthShowcase";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1360px] flex-wrap gap-6 px-4 py-5 sm:px-10">
      <aside className="bg-ink rounded-panel relative isolate flex min-w-0 flex-[1_1_420px] flex-col justify-between gap-10 overflow-hidden p-8 text-white sm:p-12">
        {/* Depth and life behind the message: brand glows, a faint grid, live bars */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
          <div className="bg-primary/40 absolute -top-40 -left-32 size-[460px] rounded-full blur-[120px]" />
          <div className="bg-accent/15 absolute right-[-120px] bottom-24 size-[360px] rounded-full blur-[110px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-[size:44px_44px]" />
        </div>
        <LiveBars />

        <Logo tone="light" />
        <div className="flex flex-col gap-5">
          <p className="font-display [animation:blur-up_900ms_var(--ease-out-strong)_both] text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-[46px]">
            Tu semana, <span className="text-accent">bajo control.</span>
          </p>
          <p className="text-on-ink animate-fade-up max-w-[420px] text-[17px] leading-relaxed [animation-delay:120ms]">
            Entra para ver tu saldo, tus gastos fijos y la proyección de los próximos días.
          </p>
        </div>
        <AuthShowcase />
        <p className="text-on-ink-muted flex items-center gap-2 text-sm font-semibold">
          <LockKeyhole aria-hidden="true" className="size-4" />
          Conexión cifrada · Contraseñas protegidas con hash
        </p>
      </aside>

      <main
        id="contenido"
        tabIndex={-1}
        className="flex min-w-0 flex-[1_1_480px] items-center justify-center py-4 outline-none"
      >
        <div className="animate-rise-in flex w-full max-w-[460px] flex-col gap-6 rounded-[32px] bg-white p-6 shadow-[0_24px_60px_-28px_rgb(21_25_61/0.25)] sm:p-10">
          <AuthTabs />
          {children}
        </div>
      </main>
    </div>
  );
}
