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
import { useState } from "react";

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

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = pathname === item.href;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${itemClass} ${active ? "bg-primary text-white" : "text-on-ink hover:bg-ink-3"}`}
    >
      <Icon aria-hidden="true" className="size-5" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

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
        <nav aria-label="Principal" className="flex flex-col gap-1.5">
          <p className="text-on-ink-muted px-3 pb-1.5 text-xs font-bold tracking-[0.08em]">MENÚ</p>
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={close} />
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
