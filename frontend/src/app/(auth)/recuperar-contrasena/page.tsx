import type { Metadata } from "next";

import { RecoverPasswordForm } from "@/components/auth/RecoverPasswordForm";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Recuperar contraseña") };
}

export default async function RecoverPasswordPage() {
  const t = await getT();
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">
        {t("Recuperar contraseña")}
      </h1>
      <RecoverPasswordForm />
    </>
  );
}
