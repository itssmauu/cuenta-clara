import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CountUp } from "./CountUp";
import { ScrollReveal } from "./ScrollReveal";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let intersect: Callback;
// Distance from the top of the viewport to each block, by test id
let tops: Record<string, number>;

function mockMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: reduce } as MediaQueryList));
}

function Page() {
  return (
    <>
      <section data-reveal data-testid="above" />
      <section data-reveal data-testid="below">
        <CountUp value={230} prefix="$" />
      </section>
      <section data-reveal data-testid="further" />
      <ScrollReveal />
    </>
  );
}

beforeEach(() => {
  tops = { above: 0, below: 2000, further: 3000 };
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (this: IntersectionObserver, callback: Callback) {
      intersect = callback;
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  // "below" starts under the fold, "above" is already on screen
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return { top: tops[this.dataset.testid ?? ""] ?? 0 } as DOMRect;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ScrollReveal", () => {
  it("hides only what is below the fold and reveals it on scroll", () => {
    mockMotion(false);
    render(<Page />);

    expect(screen.getByTestId("above")).not.toHaveAttribute("data-reveal", "hidden");
    const below = screen.getByTestId("below");
    expect(below).toHaveAttribute("data-reveal", "hidden");

    tops.below = 300; // scrolled into view
    act(() => intersect([{ isIntersecting: true, target: below }]));
    expect(below).toHaveAttribute("data-reveal", "shown");
    expect(screen.getByTestId("further")).toHaveAttribute("data-reveal", "hidden");
  });

  it("also reveals blocks skipped over by a jump to the end", () => {
    mockMotion(false);
    render(<Page />);

    tops = { above: -3000, below: -1000, further: 200 };
    act(() => intersect([{ isIntersecting: true, target: screen.getByTestId("further") }]));
    expect(screen.getByTestId("below")).toHaveAttribute("data-reveal", "shown");
    expect(screen.getByTestId("further")).toHaveAttribute("data-reveal", "shown");
  });

  it("leaves everything in place with reduced motion", () => {
    mockMotion(true);
    render(<Page />);

    expect(screen.getByTestId("below")).toHaveAttribute("data-reveal", "true");
    expect(IntersectionObserver).not.toHaveBeenCalled();
  });
});

describe("CountUp", () => {
  it("gives screen readers the final figure once", () => {
    render(<CountUp value={160} prefix="+$" />);

    const copies = screen.getAllByText("+$160");
    expect(copies).toHaveLength(2);
    expect(copies[0]).toHaveClass("sr-only");
    expect(copies[1]).toHaveAttribute("aria-hidden", "true");
  });
});
