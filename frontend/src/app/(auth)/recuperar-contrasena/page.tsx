import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Recuperar contraseña" };

// Password reset needs outgoing email, which the API does not have yet
export default function RecoverPasswordPage() {
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">
        Recuperar contraseña
      </h1>
      <p className="text-body leading-relaxed">
        La recuperación por correo todavía no está disponible. Mientras tanto, si recuerdas tu
        contraseña puedes iniciar sesión de nuevo.
      </p>
      <Link href="/login" className={buttonClass("primary", "lg")}>
        Volver a iniciar sesión
      </Link>
    </>
  );
}
