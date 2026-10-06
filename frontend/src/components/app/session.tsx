"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { ApiError, authApi, type User } from "@/lib/api";
import { financeApi, type Settings } from "@/lib/finance-api";

export type Session = {
  user: User;
  settings: Settings;
  setSettings: (settings: Settings) => void;
  logout: () => Promise<void>;
};

type SessionState =
  | { status: "loading" }
  | { status: "ready"; user: User; settings: Settings }
  | { status: "error"; message: string };

/**
 * Loads the user and their settings, and enforces where they may be:
 * no session → /login; onboarding pending → /onboarding; onboarding done → not /onboarding.
 */
export function useSessionLoader(area: "app" | "onboarding") {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([authApi.me(), financeApi.getSettings()])
      .then(([user, settings]) => {
        if (cancelled) return;
        if (area === "app" && !settings.onboarding_completed) return router.replace("/onboarding");
        if (area === "onboarding" && settings.onboarding_completed)
          return router.replace("/dashboard");
        setState({ status: "ready", user, settings });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) return router.replace("/login");
        setState({ status: "error", message: "No pudimos cargar tu cuenta. Recarga la página." });
      });
    return () => {
      cancelled = true;
    };
  }, [area, router]);

  const setSettings = useCallback(
    (settings: Settings) =>
      setState((current) => (current.status === "ready" ? { ...current, settings } : current)),
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      router.replace("/login");
    }
  }, [router]);

  return { state, setSettings, logout };
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ value, children }: { value: Session; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}
