"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buttonClass } from "@/components/ui/button";

export const COOKIE_NOTICE_KEY = "cc-cookie-notice";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isDismissed() {
  try {
    return window.localStorage.getItem(COOKIE_NOTICE_KEY) === "seen";
  } catch {
    return false; // storage blocked: show the notice, it costs nothing
  }
}

function dismiss() {
  try {
    window.localStorage.setItem(COOKIE_NOTICE_KEY, "seen");
  } catch {
    // Storage blocked: the notice hides for this page view only
  }
  listeners.forEach((listener) => listener());
}

let hiddenThisView = false;

/**
 * An informative notice, not a consent banner: we only use essential cookies, which need
 * no consent, so there is nothing to choose. It sits bottom-left to stay clear of Balbo.
 */
export function CookieNotice() {
  const hidden = useSyncExternalStore(
    subscribe,
    () => hiddenThisView || isDismissed(),
    () => true, // never rendered on the server: it depends on this browser's storage
  );
  if (hidden) return null;

  return (
    <section
      aria-label="Aviso de cookies"
      className="motion-safe:animate-rise-in fixed bottom-4 left-4 z-30 flex w-[min(380px,calc(100vw-7rem))] flex-col gap-3 rounded-3xl bg-white p-5 shadow-[0_24px_64px_-16px_rgb(21_25_61/0.35)] sm:bottom-6 sm:left-6"
    >
      <p className="text-body text-sm leading-relaxed">
        Solo usamos cookies técnicas, necesarias para iniciar sesión y proteger tu cuenta. Nada de
        publicidad ni seguimiento.{" "}
        <Link href="/legal/cookies" className="text-primary font-bold hover:underline">
          Más información
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          hiddenThisView = true;
          dismiss();
        }}
        className={buttonClass("ink", "md", "self-start")}
      >
        Entendido
      </button>
    </section>
  );
}
