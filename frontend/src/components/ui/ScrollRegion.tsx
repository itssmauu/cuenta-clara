"use client";

import { MoveRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A wide table that scrolls sideways on small screens.
 *
 * - `relative`: absolutely positioned descendants (the `sr-only` labels inside table
 *   buttons) are clipped by this box. Without it they escape and widen the whole page.
 * - A named, focusable region: keyboard users can scroll it with the arrow keys even
 *   when it holds nothing focusable (WCAG 2.1.1, axe `scrollable-region-focusable`).
 * - When the table does not fit, a hint says so: otherwise the hidden columns go unseen.
 */
export function ScrollRegion({
  label,
  busy,
  children,
}: {
  label: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const check = () => setOverflows(box.scrollWidth > box.clientWidth + 1);
    const observer = new ResizeObserver(check);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        aria-busy={busy || undefined}
        className="focus-visible:outline-focus relative overflow-x-auto rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2"
      >
        {children}
      </div>
      {overflows ? (
        <p className="text-muted flex items-center gap-1.5 text-xs font-semibold">
          Desliza la tabla para ver todas las columnas
          <MoveRight aria-hidden="true" className="size-4" />
        </p>
      ) : null}
    </div>
  );
}
