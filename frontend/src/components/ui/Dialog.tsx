"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { buttonClass } from "./button";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Modal built on the native <dialog>: the browser traps focus, closes on Esc,
 * makes the page behind inert and returns focus to the trigger on close.
 */
export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="backdrop:bg-ink/60 m-auto w-[min(560px,calc(100vw-24px))] rounded-[28px] p-0"
    >
      {open ? (
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="font-display text-2xl font-extrabold">
                {title}
              </h2>
              {description ? <p className="text-muted text-sm">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hover:bg-canvas grid size-11 shrink-0 cursor-pointer place-items-center rounded-full"
            >
              <X aria-hidden="true" className="size-5" />
              <span className="sr-only">Cerrar</span>
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Asks before anything irreversible (deleting). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <p className="text-body leading-relaxed">{message}</p>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className={buttonClass("danger")}
        >
          {busy ? "Eliminando…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
