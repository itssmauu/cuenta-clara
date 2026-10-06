"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/FormAlert";
import { ApiError, authApi, type User } from "@/lib/api";

type State =
  { status: "loading" } | { status: "ready"; user: User } | { status: "error"; message: string };

/**
 * Confirms the session against the API (the only source of truth) and greets the user.
 * Without a valid session it sends them to the login page.
 */
export function SessionGreeting() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((user) => !cancelled && setState({ status: "ready", user }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
        } else {
          setState({ status: "error", message: "No pudimos cargar tu cuenta." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      router.replace("/login");
    }
  }

  if (state.status === "loading") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Cargando tu cuenta…</span>
        <span aria-hidden="true" className="bg-canvas h-9 w-64 animate-pulse rounded-full" />
        <span aria-hidden="true" className="bg-canvas h-5 w-80 animate-pulse rounded-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <FormAlert title={state.message} />;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em]">
          Hola, {state.user.name}
        </h1>
        <p className="text-muted font-semibold">Tu panel con saldo y proyección está casi listo.</p>
      </div>
      <button type="button" onClick={logout} disabled={loggingOut} className={buttonClass("ink")}>
        {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </div>
  );
}
