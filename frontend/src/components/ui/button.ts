/** Pill button styles, shared by <button> and <Link> so both look identical. */

type Variant = "accent" | "primary" | "ink" | "ghost" | "outline-on-ink";
type Size = "md" | "lg";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-bold " +
  "transition-[background-color,opacity,transform] duration-200 ease-out " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer";

const variants: Record<Variant, string> = {
  // Coral with ink text: 6.6:1 contrast (white on coral would fail)
  accent: "bg-accent text-ink hover:bg-accent-hover",
  primary: "bg-primary text-white hover:bg-primary-hover",
  ink: "bg-ink text-white hover:bg-ink-2",
  ghost: "text-ink hover:bg-ink/5",
  "outline-on-ink": "border-2 border-ink-border text-white hover:bg-white/5",
};

const sizes: Record<Size, string> = {
  md: "px-5 text-[15px]",
  lg: "px-7 py-3.5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(" ");
}
