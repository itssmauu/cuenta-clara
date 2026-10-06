import { Check, Circle } from "lucide-react";

import { PASSWORD_RULES } from "@/lib/validation";

/** Live list of password requirements. Met rules show a check, not just a color change. */
export function PasswordChecklist({ id, password }: { id: string; password: string }) {
  const met = PASSWORD_RULES.filter((rule) => rule.test(password)).length;

  return (
    <div id={id}>
      <p className="sr-only" aria-live="polite">
        {`Cumples ${met} de ${PASSWORD_RULES.length} requisitos de la contraseña.`}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.id}
              data-met={ok}
              className={`flex items-center gap-2 text-[13px] font-semibold ${
                ok ? "text-mint-ink" : "text-muted"
              }`}
            >
              {ok ? (
                <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={3} />
              ) : (
                <Circle aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span>
                {rule.label}
                <span className="sr-only">{ok ? ": cumplido" : ": pendiente"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
