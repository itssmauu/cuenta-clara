"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Repeat,
  Settings as SettingsIcon,
  Target,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import { Logo } from "@/components/ui/Logo";

import { useSession } from "./session";

type NavItem = { href: string; label: string; icon: LucideIcon };

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ingresos", label: "Ingresos", icon: ArrowUpCircle },
  { href: "/gastos", label: "Gastos", icon: ArrowDownCircle },
  { href: "/gastos-fijos", label: "Gastos fijos", icon: Repeat },
  { href: "/prediccion", label: "Predicción", icon: TrendingUp },
  { href: "/metas", label: "Metas de ahorro", icon: Target },
  { href: "/reportes", label: "Reportes", icon: FileText },
];

const itemClass =
  "flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold transition-colors duration-200";

function NavLink({
  item,
  onNavigate,
  slidingIndicator = false,
}: {
  item: NavItem;
  onNavigate: () => void;
  /** The active background is drawn by the list's sliding indicator instead. */
  slidingIndicator?: boolean;
}) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = pathname === item.href;
  const activeClass = slidingIndicator ? "text-white" : "bg-primary text-white";
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`relative ${itemClass} ${active ? activeClass : "text-on-ink hover:bg-ink-3"}`}
    >
      <Icon aria-hidden="true" className="size-5" />
      {item.label}
    </Link>
  );
}

/**
 * The violet background behind the current page. It lives once in the list and
 * slides to the new page on navigation, so the eye follows where you went.
 */
function useNavIndicator(pathname: string) {
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;

    const place = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active || active.offsetHeight === 0) {
        indicator.style.opacity = "0";
        return;
      }
      indicator.style.opacity = "1";
      indicator.style.height = `${active.offsetHeight}px`;
      indicator.style.transform = `translateY(${active.offsetTop}px)`;
      // From the first visible placement on, changes animate
      requestAnimationFrame(() => (indicator.dataset.ready = ""));
    };
    place();

    // The phone menu starts hidden: place the indicator once it opens
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname]);

  return { navRef, indicatorRef };
}

export function Sidebar() {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { navRef, indicatorRef } = useNavIndicator(usePathname());

  return (
    <aside className="bg-ink rounded-[32px] p-4 text-white lg:sticky lg:top-5 lg:flex lg:max-h-[calc(100dvh-40px)] lg:min-h-[860px] lg:w-[250px] lg:shrink-0 lg:flex-col lg:gap-7 lg:px-5 lg:py-7">
      <div className="flex items-center justify-between gap-3 lg:px-2">
        <Logo tone="light" />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="app-nav"
          className="hover:bg-ink-3 grid size-11 cursor-pointer place-items-center rounded-full lg:hidden"
        >
          {open ? (
            <X aria-hidden="true" className="size-6" />
          ) : (
            <Menu aria-hidden="true" className="size-6" />
          )}
          <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
        </button>
      </div>

      <div
        id="app-nav"
        className={`${open ? "flex" : "hidden"} mt-4 flex-1 flex-col gap-7 lg:mt-0 lg:flex`}
      >
        <nav ref={navRef} aria-label="Principal" className="relative flex flex-col gap-1.5">
          <span
            ref={indicatorRef}
            aria-hidden="true"
            className="nav-indicator bg-primary pointer-events-none absolute inset-x-0 top-0 rounded-[14px] opacity-0"
          />
          <p className="text-on-ink-muted px-3 pb-1.5 text-xs font-bold tracking-[0.08em]">MENÚ</p>
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={close} slidingIndicator />
          ))}
        </nav>

        <div className="flex flex-col gap-1.5 lg:mt-auto">
          <NavLink
            item={{ href: "/ajustes", label: "Configuración", icon: SettingsIcon }}
            onNavigate={close}
          />
          <div className="bg-ink-3 flex items-center gap-3 rounded-[18px] p-3">
            <span
              aria-hidden="true"
              className="bg-accent text-ink grid size-10 shrink-0 place-items-center rounded-full font-extrabold"
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-bold">{user.name}</span>
              <span className="text-on-ink-muted truncate text-xs">{user.email}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="hover:bg-ink-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full"
            >
              <LogOut aria-hidden="true" className="size-5" />
              <span className="sr-only">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
