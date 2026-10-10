"use client";

import { CalendarCheck, Check, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/Dialog";
import { FormAlert } from "@/components/ui/FormAlert";
import { ApiError } from "@/lib/api";
import { financeApi, type PendingFixedExpense } from "@/lib/finance-api";
import { formatDate, formatMoney, parseISODate, todayISO } from "@/lib/format";
import { notifyDataChanged } from "@/lib/use-resource";

// How often to notice that midnight passed while the app stayed open
const DAY_CHECK_MS = 60_000;

type Answers = Record<string, boolean>; // `${expenseId}|${date}` → paid?

const keyOf = (id: string, day: string) => `${id}|${day}`;

/** "Hoy", "Ayer" or "lun, 6 oct". */
export function dayLabel(day: string, today: string): string {
  if (day === today) return "Hoy";
  const yesterday = parseISODate(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === todayISO(yesterday)) return "Ayer";
  return formatDate(day, { weekday: "short", day: "numeric", month: "short" });
}

/** Today's date, updated when the day changes while the page stays open. */
function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const check = () => setToday(todayISO());
    const timer = setInterval(check, DAY_CHECK_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return today;
}

/**
 * "Did you pay it?" A fixed expense no longer comes off the balance by itself: on the day
 * it is due (every day for daily ones) the app asks, when the user signs in or when the day
 * changes. Only what they confirm counts. "Más tarde" leaves a reminder banner.
 */
export function CheckInPrompt() {
  const { settings } = useSession();
  const today = useToday();
  const [pending, setPending] = useState<PendingFixedExpense[]>([]);
  const [open, setOpen] = useState(false);

  // Ask on entering and again when the day changes ("más tarde" waits until then)
  useEffect(() => {
    let cancelled = false;
    financeApi
      .pendingFixedExpenses(today)
      .then((items) => {
        if (cancelled) return;
        setPending(items);
        if (items.length > 0) setOpen(true);
      })
      .catch(() => {
        // Not worth interrupting the user: the next sign-in or day asks again
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const count = pending.reduce((total, item) => total + item.dates.length, 0);

  return (
    <>
      {count > 0 && !open ? (
        <section
          aria-label="Pagos por confirmar"
          className="bg-accent-tint text-ink flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-3"
        >
          <p className="flex items-center gap-2 text-sm font-bold">
            <CalendarCheck aria-hidden="true" className="size-5 shrink-0" />
            {count === 1
              ? "Tienes 1 pago por confirmar. No se descuenta hasta que lo confirmes."
              : `Tienes ${count} pagos por confirmar. No se descuentan hasta que los confirmes.`}
          </p>
          <button type="button" onClick={() => setOpen(true)} className={buttonClass("ink")}>
            Revisar
          </button>
        </section>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="¿Ya pagaste estos gastos?"
        description="Solo se descuentan de tu saldo los que confirmes."
      >
        <CheckInForm
          key={pending.map((p) => p.id + p.dates.join()).join()}
          pending={pending}
          today={today}
          currency={settings.currency}
          onLater={() => setOpen(false)}
          onSaved={(remaining) => {
            setPending(remaining);
            notifyDataChanged();
            if (remaining.length === 0) setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

function CheckInForm({
  pending,
  today,
  currency,
  onLater,
  onSaved,
}: {
  pending: PendingFixedExpense[];
  today: string;
  currency: string;
  onLater: () => void;
  onSaved: (remaining: PendingFixedExpense[]) => void;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answered = Object.keys(answers).length;

  function set(id: string, days: string[], paid: boolean) {
    setAnswers((current) => {
      const next = { ...current };
      for (const day of days) next[keyOf(id, day)] = paid;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const list = Object.entries(answers).map(([key, paid]) => {
      const [fixed_expense_id, occurs_on] = key.split("|") as [string, string];
      return { fixed_expense_id, occurs_on, paid };
    });
    try {
      await financeApi.answerCheckIns(list, today);
      const remaining = pending
        .map((item) => ({
          ...item,
          dates: item.dates.filter((day) => answers[keyOf(item.id, day)] === undefined),
        }))
        .filter((item) => item.dates.length > 0);
      onSaved(remaining);
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : "No pudimos guardar tus respuestas.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? <FormAlert title={error} /> : null}
      <ul className="-mx-1 flex max-h-[min(52dvh,460px)] flex-col gap-4 overflow-y-auto px-1">
        {pending.map((item) => (
          <li key={item.id} className="border-line flex flex-col gap-2 rounded-3xl border-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="font-bold">{item.name}</h3>
              <span className="text-muted text-sm font-semibold">
                {formatMoney(item.amount, currency)} · {item.account_name}
              </span>
            </div>
            {item.dates.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => set(item.id, item.dates, true)}
                  className="text-primary hover:bg-primary-tint min-h-11 cursor-pointer rounded-full px-3 text-[13px] font-bold"
                >
                  Pagué todos ({item.dates.length})
                </button>
                <button
                  type="button"
                  onClick={() => set(item.id, item.dates, false)}
                  className="text-body hover:bg-canvas min-h-11 cursor-pointer rounded-full px-3 text-[13px] font-bold"
                >
                  No pagué ninguno
                </button>
              </div>
            ) : null}
            <ul className="flex flex-col">
              {item.dates.map((day) => (
                <DayRow
                  key={day}
                  label={`${dayLabel(day, today)} · ${item.name}`}
                  day={dayLabel(day, today)}
                  value={answers[keyOf(item.id, day)]}
                  onChange={(paid) => set(item.id, [day], paid)}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={onLater} className={buttonClass("ghost")}>
          Más tarde
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || answered === 0}
          aria-busy={busy}
          className={buttonClass("primary")}
        >
          {busy
            ? "Guardando…"
            : answered === 0
              ? "Guardar respuestas"
              : `Guardar ${answered} ${answered === 1 ? "respuesta" : "respuestas"}`}
        </button>
      </div>
    </div>
  );
}

function DayRow({
  label,
  day,
  value,
  onChange,
}: {
  label: string;
  day: string;
  value: boolean | undefined;
  onChange: (paid: boolean) => void;
}) {
  return (
    <li className="border-line border-t py-1.5 first:border-t-0">
      <div role="group" aria-label={label} className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold first-letter:uppercase">{day}</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-pressed={value === true}
            onClick={() => onChange(true)}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-bold transition-[background-color,color,border-color,scale] duration-200 active:scale-[0.96] ${
              value === true
                ? "bg-mint-tint border-mint text-ink"
                : "border-line text-body hover:border-primary-soft"
            }`}
          >
            <Check aria-hidden="true" className="size-4" />
            Lo pagué
          </button>
          <button
            type="button"
            aria-pressed={value === false}
            onClick={() => onChange(false)}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-bold transition-[background-color,color,border-color,scale] duration-200 active:scale-[0.96] ${
              value === false
                ? "bg-canvas border-ink text-ink"
                : "border-line text-body hover:border-primary-soft"
            }`}
          >
            <X aria-hidden="true" className="size-4" />
            No
          </button>
        </div>
      </div>
    </li>
  );
}
