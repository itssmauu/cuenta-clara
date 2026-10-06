import Link from "next/link";

const tabs = [
  { href: "/login", label: "Iniciar sesión" },
  { href: "/register", label: "Registrarme" },
] as const;

/** Login / register switch. Real links (not JS tabs) so each form has its own URL. */
export function AuthTabs({ active }: { active: "/login" | "/register" }) {
  return (
    <nav aria-label="Acceso" className="bg-canvas flex gap-1.5 rounded-full p-[5px]">
      {tabs.map((tab) => {
        const current = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-[15px] font-bold transition-colors duration-200 ${
              current ? "bg-ink text-white" : "text-ink hover:bg-ink/5"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
