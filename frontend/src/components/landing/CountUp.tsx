/**
 * A figure that ScrollReveal counts up from 0. Screen readers get the final value
 * once, from the hidden copy; the animated digits are hidden from them.
 */
export function CountUp({
  value,
  prefix = "",
  delayMs = 0,
}: {
  value: number;
  prefix?: string;
  delayMs?: number;
}) {
  const text = `${prefix}${value}`;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span
        aria-hidden="true"
        data-count-to={value}
        data-count-prefix={prefix}
        data-count-delay={delayMs}
      >
        {text}
      </span>
    </>
  );
}
