import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Iniciar sesión") };
}

export default async function LoginPage() {
  const t = await getT();
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">
        {t("Bienvenido de vuelta")}
      </h1>
      <LoginForm />
    </>
  );
}
