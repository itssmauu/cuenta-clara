import { ArrowRight, Loader2 } from "lucide-react";

import { buttonClass } from "./button";

/**
 * The main button of a form. It lifts slightly on hover with a soft glow, its arrow
 * nudges forward (the next step is ahead), it squeezes when pressed, and while the
 * request runs the label blurs into a spinner and "Entrando…".
 */
export function SubmitButton({
  busy,
  label,
  busyLabel,
}: {
  busy: boolean;
  label: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className={buttonClass(
        "primary",
        "lg",
        "group hover:shadow-primary/35 min-h-[52px] font-extrabold hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:shadow-none",
      )}
    >
      <span
        key={busy ? "busy" : "idle"}
        className="animate-value-in inline-flex items-center gap-2"
      >
        {busy ? <Loader2 aria-hidden="true" className="size-5 motion-safe:animate-spin" /> : null}
        {busy ? busyLabel : label}
        {busy ? null : (
          <ArrowRight
            aria-hidden="true"
            className="ease-out-strong size-5 transition-[translate] duration-200 group-hover:translate-x-1"
          />
        )}
      </span>
    </button>
  );
}
