import type { Metadata } from "next";

import { RecoverPasswordForm } from "@/components/auth/RecoverPasswordForm";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPasswordPage() {
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">
        Recuperar contraseña
      </h1>
      <RecoverPasswordForm />
    </>
  );
}
