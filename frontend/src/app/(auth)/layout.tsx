import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1360px] flex-wrap gap-6 px-4 py-5 sm:px-10">
      <aside className="bg-ink rounded-panel flex min-w-0 flex-[1_1_420px] flex-col justify-between gap-10 p-8 text-white sm:p-12">
        <Logo tone="light" />
        <div className="flex flex-col gap-5">
          <p className="font-display text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-[46px]">
            Tu semana, <span className="text-accent">bajo control.</span>
          </p>
          <p className="text-on-ink max-w-[420px] text-[17px] leading-relaxed">
            Entra para ver tu saldo, tus gastos fijos y la proyección de los próximos días.
          </p>
        </div>
        <p className="text-on-ink-muted flex items-center gap-2 text-sm font-semibold">
          <LockKeyhole aria-hidden="true" className="size-4" />
          Conexión cifrada · Contraseñas protegidas con hash
        </p>
      </aside>

      <main className="flex min-w-0 flex-[1_1_480px] items-center justify-center py-4">
        <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-[32px] bg-white p-6 sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
