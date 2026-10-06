import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { connection } from "next/server";
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

export const metadata: Metadata = {
  title: {
    default: "Cuenta Clara · Sabe cuánto te queda antes de gastarlo",
    template: "%s · Cuenta Clara",
  },
  description:
    "Registra tu monto inicial, tus gastos fijos y tus ingresos. Cuenta Clara proyecta tu semana y te avisa si vas por encima de tu límite.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request: the CSP nonce set in proxy.ts only reaches
  // dynamically rendered pages (static HTML is built before any request exists)
  await connection();

  return (
    <html lang="es" className={`${sora.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">
        {/* First stop for keyboard users: jump past the navigation */}
        <a
          href="#contenido"
          className="bg-ink sr-only rounded-full px-5 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
