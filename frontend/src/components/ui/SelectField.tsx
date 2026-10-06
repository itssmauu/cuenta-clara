import type { ComponentProps } from "react";

type SelectFieldProps = ComponentProps<"select"> & {
  id: string;
  label: string;
  error?: string;
  options: { value: string; label: string }[];
};

export function SelectField({ id, label, error, options, ...select }: SelectFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-field text-ink min-h-12 w-full cursor-pointer border-2 bg-white px-4 text-[15px] transition-colors duration-200 ${
          error ? "border-danger" : "border-field hover:border-primary-soft"
        }`}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="text-danger text-[13px] font-semibold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
