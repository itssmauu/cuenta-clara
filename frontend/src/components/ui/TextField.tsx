import type { ComponentProps, ReactNode } from "react";

type TextFieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Extra content inside the field box, e.g. the show-password button */
  trailing?: ReactNode;
};

/**
 * A labelled input whose error is announced and linked with aria-describedby,
 * so screen readers read it together with the field.
 */
export function TextField({
  id,
  label,
  error,
  hint,
  trailing,
  className = "",
  ...input
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`text-ink placeholder:text-muted/80 rounded-field min-h-12 w-full border-2 bg-white px-4 text-[15px] transition-colors duration-200 ${
            error ? "border-danger" : "border-field hover:border-primary-soft"
          } ${trailing ? "pr-14" : ""} ${className}`}
          {...input}
        />
        {trailing}
      </div>
      {hint ? (
        <div id={hintId} className="text-muted text-[13px]">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-danger text-[13px] font-semibold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
