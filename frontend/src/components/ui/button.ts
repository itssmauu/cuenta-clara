/** Pill button styles, shared by <button> and <Link> so both look identical. */

type Variant = "accent" | "primary" | "ink" | "ghost" | "outline-on-ink" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-bold " +
  // Press feedback: a quick, subtle squeeze so the button feels like it listened.
  // Tailwind v4 scales and translates through their own properties, not `transform`.
  "transition-[background-color,color,opacity,box-shadow,translate,scale] duration-200 ease-out-strong " +
  "active:scale-[0.97] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 " +
  "disabled:active:scale-100 cursor-pointer";

const variants: Record<Variant, string> = {
  // Coral with ink text: 6.6:1 contrast (white on coral would fail)
  accent: "bg-accent text-ink hover:bg-accent-hover",
  primary: "bg-primary text-white hover:bg-primary-hover",
  ink: "bg-ink text-white hover:bg-ink-2",
  ghost: "text-ink hover:bg-ink/5",
  "outline-on-ink": "border-2 border-ink-border text-white hover:bg-white/5",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  md: "px-5 text-[15px]",
  lg: "px-7 py-3.5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(" ");
}
