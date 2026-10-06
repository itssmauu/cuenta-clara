import Link from "next/link";

type LogoProps = { tone?: "ink" | "light"; className?: string };

export function Logo({ tone = "ink", className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`font-display inline-flex min-h-11 items-center gap-2.5 text-[22px] font-bold ${
        tone === "light" ? "text-white" : "text-ink"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className="bg-primary grid size-[34px] place-items-center rounded-[10px]"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="white" strokeWidth="3">
          <path d="M6 12.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Cuenta Clara
    </Link>
  );
}
