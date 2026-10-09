"use client";

import { FileCheck2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/FormAlert";
import { Logo } from "@/components/ui/Logo";
import type { User } from "@/lib/api";
import { LEGAL } from "@/lib/legal";
import { privacyApi } from "@/lib/privacy-api";

import { DeleteAccountButton, ExportDataButton } from "./PrivacyControls";

/**
 * Shown instead of the app when the Terms or the Privacy Policy changed since the user
 * accepted them: consent must be renewed explicitly, never assumed from continued use.
 */
export function TermsGate({
  onAccepted,
  onLogout,
}: {
  onAccepted: (user: User) => void;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => titleRef.current?.focus(), []);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      onAccepted(await privacyApi.acceptTerms(LEGAL.version));
    } catch {
      setError("No pudimos guardar tu aceptación. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <div className="bg-canvas-dashboard grid min-h-dvh place-items-center p-4">
      <main
        id="contenido"
        className="animate-rise-in flex w-full max-w-[520px] flex-col gap-6 rounded-[32px] bg-white p-6 sm:p-10"
      >
        <Logo />
        <div className="flex flex-col gap-3">
          <span className="bg-primary-tint text-primary grid size-12 place-items-center rounded-2xl">
            <FileCheck2 aria-hidden="true" className="size-6" />
          </span>
          <h1
            ref={titleRef}
            tabIndex={-1}
            className="font-display text-2xl font-extrabold tracking-[-0.02em] outline-none"
          >
            Actualizamos nuestros términos
          </h1>
          <p className="text-body text-[15px] leading-relaxed">
            Para seguir usando {LEGAL.service}, revisa y acepta la versión vigente desde el{" "}
            {LEGAL.updatedOn} de estos documentos:
          </p>
          <ul className="flex flex-col gap-1 text-[15px] font-bold">
            <li>
              <Link href="/legal/terminos" target="_blank" className="text-primary hover:underline">
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link
                href="/legal/privacidad"
                target="_blank"
                className="text-primary hover:underline"
              >
                Política de privacidad
              </Link>
            </li>
          </ul>
        </div>
        {error ? <FormAlert title={error} /> : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void accept()}
            disabled={busy}
            className={buttonClass("primary", "lg")}
          >
            {busy ? "Guardando…" : "Acepto los nuevos términos"}
          </button>
          <button
            type="button"
            onClick={() => void onLogout()}
            className={buttonClass("ghost", "lg")}
          >
            Cerrar sesión
          </button>
        </div>
        <section
          aria-labelledby="gate-rights-title"
          className="border-line flex flex-col gap-3 border-t pt-5"
        >
          <h2 id="gate-rights-title" className="text-ink text-sm font-bold">
            ¿No estás de acuerdo?
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            No tienes que aceptar para ejercer tus derechos: puedes descargar una copia de tus datos
            o eliminar tu cuenta ahora mismo.
          </p>
          <div className="flex flex-wrap gap-3">
            <ExportDataButton onError={setError} />
            <DeleteAccountButton />
          </div>
        </section>
      </main>
    </div>
  );
}
