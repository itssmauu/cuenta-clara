"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "./api";

export type Resource<T> =
  | { status: "loading"; data?: T }
  | { status: "ready"; data: T }
  | { status: "error"; error: ApiError; data?: T };

type Settled<T> = { requestId: string; data?: T; error?: ApiError };

/**
 * Loads data on the client (session cookies are scoped to /api, so pages can't
 * fetch it on the server). Refetches when `key` changes or `reload()` is called,
 * and keeps the previous data visible meanwhile.
 *
 * "Loading" is derived (the latest request hasn't settled yet) instead of being set
 * inside the effect, so the effect only ever updates state asynchronously.
 */
export function useResource<T>(key: string, load: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const requestId = `${key}#${version}`;

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setSettled({ requestId, data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const apiError = error instanceof ApiError ? error : new ApiError(0, "Error inesperado.");
        setSettled((previous) => ({ requestId, error: apiError, data: previous?.data }));
      });
    return () => {
      cancelled = true;
    };
    // `load` is recreated on every render; `requestId` decides when to refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  let state: Resource<T>;
  if (settled?.requestId !== requestId) {
    state = { status: "loading", data: settled?.data };
  } else if (settled.error) {
    state = { status: "error", error: settled.error, data: settled.data };
  } else {
    state = { status: "ready", data: settled.data as T };
  }
  return [state, reload] as const;
}
