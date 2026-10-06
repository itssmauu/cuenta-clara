"use client";

import Link from "next/link";
import { useEffect } from "react";

import { buttonClass } from "@/components/ui/button";

/** Last-resort screen when a page crashes. Never shows technical details to the user. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Visible in the browser console for debugging; the digest matches the server log
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-8 px-4 py-6 sm:px-10">
      <main
        id="contenido"
        tabIndex={-1}
        className="rounded-panel flex flex-col items-start gap-5 bg-white p-8 outline-none sm:p-12"
      >
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">
          Algo salió mal
        </h1>
        <p className="text-body leading-relaxed">
          Tuvimos un problema al mostrar esta página. Tus datos están a salvo. Intenta de nuevo y,
          si sigue pasando, vuelve más tarde.
        </p>
        {error.digest ? (
          <p className="text-muted text-sm">Código de referencia: {error.digest}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={reset} className={buttonClass("primary")}>
            Intentar de nuevo
          </button>
          <Link href="/" className={buttonClass("ghost")}>
            Ir al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
