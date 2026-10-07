"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/login", label: "Iniciar sesión" },
  { href: "/register", label: "Registrarme" },
] as const;

// The active pill as a clip of the overlay: half the bar minus the 5px padding and 6px gap
const CLIP = {
  "/login": "[clip-path:inset(5px_calc(50%+3px)_5px_5px_round_999px)]",
  "/register": "[clip-path:inset(5px_5px_5px_calc(50%+3px)_round_999px)]",
} as const;

/**
 * Login / register switch. Real links (not JS tabs) so each form has its own URL.
 * It lives in the shared layout, so it stays mounted between the two pages and its
 * active pill slides across instead of jumping. The pill is an identical copy of the
 * tabs styled as active and clipped to one half: hidden from screen readers and clicks.
 */
export function AuthTabs() {
  const pathname = usePathname();
  if (pathname !== "/login" && pathname !== "/register") return null;

  return (
    <nav aria-label="Acceso" className="bg-canvas relative flex gap-1.5 rounded-full p-[5px]">
      {tabs.map((tab) => {
        const current = tab.href === pathname;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-[15px] font-bold transition-colors duration-200 ${
              current ? "" : "text-ink hover:bg-ink/5"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      <div
        aria-hidden="true"
        className={`auth-tabs-overlay bg-ink pointer-events-none absolute inset-0 flex gap-1.5 rounded-full p-[5px] text-white ${CLIP[pathname]}`}
      >
        {tabs.map((tab) => (
          <span
            key={tab.href}
            className="flex min-h-11 flex-1 items-center justify-center text-[15px] font-bold"
          >
            {tab.label}
          </span>
        ))}
      </div>
    </nav>
  );
}
