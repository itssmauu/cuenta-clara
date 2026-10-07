"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

type Option<T> = { value: T; label: ReactNode; ariaLabel?: string };

type Props<T extends string | number> = {
  /** Accessible name of the group ("Periodo"). */
  label: string;
  options: readonly Option<T>[];
  /** Undefined while the choice is not known yet (no option looks selected). */
  value: T | undefined;
  onChange: (value: T) => void;
  /** Layout of the options (flex, or a grid on narrow screens). */
  layoutClass?: string;
  /** Size of each option. */
  optionClass?: string;
};

/**
 * Toggle buttons whose active pill slides to the chosen option.
 *
 * The options are drawn twice: the real buttons, and an identical copy styled as
 * active (ink with white text) on top, clipped to the chosen option. Animating the
 * clip moves the pill and swaps the text color in one motion, with no moment where
 * two colors overlap. The copy is decorative: hidden from screen readers and clicks.
 */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  layoutClass = "flex",
  optionClass = "px-4 text-sm",
}: Props<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<T, HTMLButtonElement>());

  useLayoutEffect(() => {
    const group = groupRef.current;
    const overlay = overlayRef.current;
    if (!group || !overlay) return;

    const place = () => {
      const button = value === undefined ? undefined : buttonRefs.current.get(value);
      if (!button) {
        overlay.style.clipPath = "inset(50%)"; // nothing selected: no pill
        return;
      }
      const top = button.offsetTop;
      const left = button.offsetLeft;
      const right = group.clientWidth - left - button.offsetWidth;
      const bottom = group.clientHeight - top - button.offsetHeight;
      overlay.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round 999px)`;
    };
    place();

    // The layout changes between phone (grid) and desktop (row): follow it
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(group);
    return () => observer.disconnect();
  }, [value]);

  // Only animate changes, never the first placement
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (overlayRef.current) overlayRef.current.dataset.ready = "";
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const optionBase = `min-h-11 min-w-11 rounded-full font-bold ${optionClass}`;

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={label}
      className={`relative gap-1 rounded-full bg-white p-1 ${layoutClass}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          ref={(node) => {
            if (node) buttonRefs.current.set(option.value, node);
            else buttonRefs.current.delete(option.value);
          }}
          type="button"
          aria-label={option.ariaLabel}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`${optionBase} hover:bg-ink/5 cursor-pointer transition-colors duration-200`}
        >
          {option.label}
        </button>
      ))}

      <div
        ref={overlayRef}
        aria-hidden="true"
        className={`segmented-overlay bg-ink pointer-events-none absolute inset-0 gap-1 rounded-full p-1 text-white ${layoutClass}`}
      >
        {options.map((option) => (
          <span key={option.value} className={`${optionBase} grid place-items-center`}>
            {option.label}
          </span>
        ))}
      </div>
    </div>
  );
}
