"use client";

import { useEffect } from "react";

const COUNT_DURATION_MS = 1200;

/**
 * Fades landing blocks in as they scroll into view and counts their figures up
 * from 0. Renders nothing: server components opt in with `data-reveal` and
 * `<CountUp>`. Each block animates once; re-animating on every pass would fight
 * the reader.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pending = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
      // Only what the visitor has not seen yet: hiding visible content would flash
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    );
    for (const el of pending) el.dataset.reveal = "hidden";

    const reveal = (el: HTMLElement) => {
      if (el.dataset.reveal !== "hidden") return;
      observer.unobserve(el);
      el.dataset.reveal = "shown";
      el.querySelectorAll<HTMLElement>("[data-count-to]").forEach(countUp);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        // Reveal what came into view and anything already scrolled past (a jump with
        // End or an anchor link skips blocks that would otherwise stay hidden above)
        for (const el of pending) {
          if (el.getBoundingClientRect().top < window.innerHeight) reveal(el);
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    pending.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      // Never leave content hidden behind (e.g. on a fast navigation away)
      for (const el of pending) el.dataset.reveal = "shown";
    };
  }, []);

  return null;
}

function countUp(el: HTMLElement) {
  const target = Number(el.dataset.countTo);
  const prefix = el.dataset.countPrefix ?? "";
  const start = performance.now() + Number(el.dataset.countDelay ?? 0);
  el.textContent = `${prefix}0`;

  const tick = (now: number) => {
    const t = Math.min(Math.max((now - start) / COUNT_DURATION_MS, 0), 1);
    const eased = 1 - (1 - t) ** 3; // ease-out cubic: fast start, gentle landing
    el.textContent = `${prefix}${Math.round(target * eased)}`;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
