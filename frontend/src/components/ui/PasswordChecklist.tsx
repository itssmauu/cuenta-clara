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
              {/* Keyed by state: a rule that becomes met pops its check in */}
              <span
                key={String(ok)}
                aria-hidden="true"
                className="grid shrink-0 animate-[pop_260ms_var(--ease-out-strong)] place-items-center"
              >
                {ok ? <Check className="size-4" strokeWidth={3} /> : <Circle className="size-4" />}
              </span>
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
