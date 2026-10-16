import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { connection } from "next/server";
import { CookieNotice } from "@/components/legal/CookieNotice";
import { LocaleProvider } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { translator } from "@/i18n/translate";

import "./globals.css";

// Self-hosted at build time by next/font: no request to Google, no layout shift
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: {
      default: t("Cuenta Clara · Sabe cuánto te queda antes de gastarlo"),
      template: "%s · Cuenta Clara",
    },
    description: t(
      "Registra tu monto inicial, tus gastos fijos y tus ingresos. Cuenta Clara proyecta tu semana y te avisa si vas por encima de tu límite.",
    ),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request: the CSP nonce set in proxy.ts only reaches
  // dynamically rendered pages (static HTML is built before any request exists)
  await connection();
  const locale = await getLocale();
  const t = translator(locale);

  return (
    <html lang={locale} className={`${sora.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">
        {/* First stop for keyboard users: jump past the navigation */}
        <a
          href="#contenido"
          className="bg-ink sr-only rounded-full px-5 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          {t("Saltar al contenido")}
        </a>
        <LocaleProvider initial={locale}>
          {children}
          <CookieNotice />
        </LocaleProvider>
      </body>
    </html>
  );
}
