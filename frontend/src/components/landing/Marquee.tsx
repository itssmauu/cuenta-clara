"use client";

import { Pause, Play } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * A band that glides sideways. Moving content that lasts more than five seconds
 * needs a way to stop it (WCAG 2.2.2), so besides pausing under the pointer or
 * keyboard focus it has a real pause button. With reduced motion it never moves.
 */
export function Marquee({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      <div
        data-paused={paused || undefined}
        className="marquee w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]"
      >
        <div className="marquee-track flex w-max motion-reduce:w-auto">{children}</div>
      </div>
      <button
        type="button"
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
        className="marquee-toggle text-muted hover:text-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors duration-200 motion-reduce:hidden"
      >
        {paused ? (
          <Play aria-hidden="true" className="size-3.5" />
        ) : (
          <Pause aria-hidden="true" className="size-3.5" />
        )}
        {paused ? "Reanudar animación" : "Pausar animación"}
      </button>
    </div>
  );
}
