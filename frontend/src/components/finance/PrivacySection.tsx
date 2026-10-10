"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { DeleteAccountButton, ExportDataButton } from "@/components/legal/PrivacyControls";
import { buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/FormAlert";
import { assistantApi } from "@/lib/assistant-api";
import { privacyApi } from "@/lib/privacy-api";

/**
 * The user's rights in one place: a copy of their data, turning the AI assistant on or
 * off, and deleting the account. Each one works on its own, without writing to anyone.
 */
export function PrivacySection({ onNotice }: { onNotice: (message: string) => void }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      aria-labelledby="privacy-title"
      className="flex flex-col gap-6 rounded-[32px] bg-white p-6 sm:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="privacy-title" className="font-display text-xl font-bold">
          Privacidad y datos
        </h2>
        <p className="text-muted text-sm">
          Tus datos son tuyos. Lee cómo los tratamos en la{" "}
          <Link href="/legal/privacidad" className="text-primary font-bold hover:underline">
            Política de privacidad
          </Link>
          .
        </p>
      </div>
      {error ? <FormAlert title={error} /> : null}

      <PrivacyRow
        title="Descargar mis datos"
        text="Un archivo JSON con todo lo que guardamos de ti: cuenta, configuración, cuentas, movimientos, metas y sesiones."
      >
        <ExportDataButton onError={setError} />
      </PrivacyRow>

      <AssistantConsentRow onNotice={onNotice} onError={setError} />

      <PrivacyRow
        title="Eliminar mi cuenta"
        text="Borra tu cuenta y todos tus datos de forma inmediata y definitiva."
      >
        <DeleteAccountButton />
      </PrivacyRow>
    </section>
  );
}

function PrivacyRow({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="border-line flex flex-wrap items-center justify-between gap-4 border-t pt-5">
      <div className="flex max-w-[520px] min-w-0 flex-col gap-1">
        <h3 className="font-bold">{title}</h3>
        <p className="text-muted text-sm leading-relaxed">{text}</p>
      </div>
      {children}
    </div>
  );
}

function AssistantConsentRow({
  onNotice,
  onError,
}: {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [consented, setConsented] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    assistantApi
      .status()
      .then((status) => !cancelled && setConsented(status.consented))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    const next = !consented;
    setBusy(true);
    try {
      await (next ? privacyApi.grantAssistant() : privacyApi.revokeAssistant());
      setConsented(next);
      onNotice(next ? "Balbo está activado." : "Balbo está desactivado. Ya no se envía nada.");
    } catch {
      onError("No pudimos cambiar el estado de Balbo. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PrivacyRow
      title="Balbo, el asistente con IA"
      text={
        consented
          ? "Activado: al preguntarle, se envía a Gemini (Google) tu pregunta y un resumen de tus finanzas. Desactívalo y no se enviará nada más."
          : "Desactivado: no se envía nada a Google. Puedes activarlo aquí o desde el chat."
      }
    >
      <button
        type="button"
        disabled={consented === null || busy}
        onClick={() => void toggle()}
        className={buttonClass(consented ? "ghost" : "primary", "md", "border-line border-2")}
      >
        {failed
          ? "No disponible ahora"
          : consented === null
            ? "Cargando…"
            : consented
              ? "Desactivar Balbo"
              : "Activar Balbo"}
      </button>
    </PrivacyRow>
  );
}
