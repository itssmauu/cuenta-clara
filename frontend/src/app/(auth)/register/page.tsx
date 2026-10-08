import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">Crea tu cuenta</h1>
      <RegisterForm />
    </>
  );
}
