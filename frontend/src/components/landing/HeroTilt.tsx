"use client";

import { useEffect, useRef, type ReactNode } from "react";

const MAX_DEG = 7;
// Spring: soft enough to feel like it has weight, damped so it never wobbles
const STIFFNESS = 120;
const DAMPING = 16;

/**
 * Tilts its content toward the cursor. Purely decorative (marketing page only):
 * tying the angle straight to the mouse would feel mechanical, so the angle
 * follows a spring that carries momentum. Mouse and trackpad only, and never
 * with reduced motion.
 */
export function HeroTilt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const media = (query: string) => window.matchMedia(query).matches;
    if (!el || !media("(hover: hover) and (pointer: fine)")) return;
    if (media("(prefers-reduced-motion: reduce)")) return;

    const target = { x: 0, y: 0 };
    const angle = { x: 0, y: 0 };
    const speed = { x: 0, y: 0 };
    let frame = 0;
    let last = 0;

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      for (const axis of ["x", "y"] as const) {
        const force = STIFFNESS * (target[axis] - angle[axis]) - DAMPING * speed[axis];
        speed[axis] += force * dt;
        angle[axis] += speed[axis] * dt;
      }
      // Transform set on the element itself: no style recalculation for its children
      el.style.transform = `perspective(900px) rotateX(${angle.x.toFixed(2)}deg) rotateY(${angle.y.toFixed(2)}deg)`;
      const settled =
        Math.abs(target.x - angle.x) + Math.abs(target.y - angle.y) < 0.01 &&
        Math.abs(speed.x) + Math.abs(speed.y) < 0.01;
      frame = settled ? 0 : requestAnimationFrame(step);
    };

    const wake = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      // -1…1 from the center of the phone, clamped so far-away cursors don't over-rotate
      const dx = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / 600));
      const dy = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height / 2)) / 600));
      target.x = -dy * MAX_DEG;
      target.y = dx * MAX_DEG;
      wake();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      wake();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  );
}
