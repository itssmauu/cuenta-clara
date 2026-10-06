"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";

type FormAlertProps = { title: string; items?: string[] };

/**
 * Error summary shown after a failed submit. It takes focus so keyboard and
 * screen reader users land on it instead of having to search for what went wrong.
 */
export function FormAlert({ title, items = [] }: FormAlertProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [title, items]);

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="bg-danger-tint text-danger flex gap-3 rounded-2xl p-4 text-sm font-semibold"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-1.5">
        <p>{title}</p>
        {items.length > 0 ? (
          <ul className="list-disc pl-4 font-medium">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
