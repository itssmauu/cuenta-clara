"use client";

import type { ReactNode } from "react";

import { FormAlert } from "@/components/ui/FormAlert";

import { SessionProvider, useSessionLoader } from "./session";
import { Sidebar } from "./Sidebar";

/** Layout of every signed-in page: sidebar + content, rendered once the session is confirmed. */
export function AppShell({ children }: { children: ReactNode }) {
  const { state, setSettings, logout } = useSessionLoader("app");

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-xl p-6">
        <FormAlert title={state.message} />
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div role="status" className="bg-canvas-dashboard grid min-h-dvh place-items-center">
        <span className="text-muted font-semibold">Cargando tu cuenta…</span>
      </div>
    );
  }

  return (
    <SessionProvider value={{ user: state.user, settings: state.settings, setSettings, logout }}>
      <div className="bg-canvas-dashboard min-h-dvh">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-5 p-3 sm:p-5 lg:flex-row">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
        </div>
      </div>
    </SessionProvider>
  );
}
