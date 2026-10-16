import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Crear cuenta") };
}

export default async function RegisterPage() {
  const t = await getT();
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">
        {t("Crea tu cuenta")}
      </h1>
      <RegisterForm />
    </>
  );
}
