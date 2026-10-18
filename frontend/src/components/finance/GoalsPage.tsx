"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, LineChart, PiggyBank, Plus } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState, Notice, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { useT } from "@/i18n/client";
import { msg, rich } from "@/i18n/translate";
import { ApiError } from "@/lib/api";
import { financeApi, type Account, type Frequency, type SavingsGoal } from "@/lib/finance-api";
import {
  contributionSchema,
  goalSchema,
  type ContributionForm,
  type GoalForm,
  type GoalValues,
} from "@/lib/finance-validation";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { projectGoal } from "@/lib/goal-projection";
import { useResource } from "@/lib/use-resource";

import { accountName, accountOptions } from "./accounts-ui";
import { GoalTrend } from "./GoalTrend";
import { RowActions } from "./RowActions";

/** "por semana (3 semanas)", "por mes (este mes)" */
const PERIOD_WORDS: Record<Frequency, { one: string; current: string; many: string }> = {
  daily: { one: msg("día"), current: msg("hoy"), many: msg("{n} días") },
  weekly: { one: msg("semana"), current: msg("esta semana"), many: msg("{n} semanas") },
  biweekly: { one: msg("quincena"), current: msg("esta quincena"), many: msg("{n} quincenas") },
  monthly: { one: msg("mes"), current: msg("este mes"), many: msg("{n} meses") },
  custom: { one: msg("periodo"), current: msg("este periodo"), many: msg("{n} periodos") },
};

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function GoalsPage() {
  const t = useT();
  const { settings } = useSession();
  const [today] = useState(todayISO);
  const [goals, reload] = useResource(`goals:${today}`, () => financeApi.listGoals(today));
  const [accountList] = useResource(`accounts:${today}`, () => financeApi.listAccounts(today));
  const accounts = accountList.data ?? [];
  const [editing, setEditing] = useState<{ item: SavingsGoal | null } | null>(null);
  const [contributing, setContributing] = useState<SavingsGoal | null>(null);
  const [trending, setTrending] = useState<SavingsGoal | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await financeApi.deleteGoal(deleting.id);
      showNotice(t("Meta «{name}» eliminada.", { name: deleting.name }));
      reload();
    } catch (caught) {
      setError(apiMessage(caught, msg("No pudimos eliminar la meta.")));
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  }

  const items = goals.data;
  const addButton = (
    <button
      type="button"
      onClick={() => setEditing({ item: null })}
      className={buttonClass("accent", "md", "font-extrabold")}
    >
      <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
      {t("Nueva meta")}
    </button>
  );

  return (
    <>
      <PageHeader
        title={t("Metas de ahorro")}
        subtitle={t("Aparta dinero para lo que quieres")}
        actions={addButton}
      />
      <Notice message={notice} />
      {error ? <FormAlert title={error} /> : null}

      {goals.status === "error" && !items ? (
        <FormAlert title={t("No pudimos cargar tus metas.")} items={[goals.error.message]} />
      ) : !items ? (
        <TableSkeleton rows={2} />
      ) : items.length === 0 ? (
        <section className="rounded-[32px] bg-white p-6 sm:p-7">
          <EmptyState
            headingLevel={2}
            icon={PiggyBank}
            title={t("Aún no tienes metas de ahorro")}
            text={t(
              "Crea una meta (una laptop, un viaje, un fondo de emergencia) y te diremos cuánto apartar cada periodo para llegar a tiempo.",
            )}
            action={addButton}
          />
        </section>
      ) : (
        <ul aria-label={t("Tus metas")} className="grid gap-5 md:grid-cols-2">
          {items.map((goal) => (
            <li key={goal.id}>
              <GoalCard
                goal={goal}
                currency={settings.currency}
                period={settings.income_period}
                accountLabel={accounts.length > 1 ? accountName(accounts, goal.account_id) : ""}
                onContribute={() => setContributing(goal)}
                onTrend={() => setTrending(goal)}
                onEdit={() => setEditing({ item: goal })}
                onDelete={() => setDeleting(goal)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.item ? t("Editar meta") : t("Nueva meta")}
      >
        <GoalFormBody
          item={editing?.item ?? null}
          accounts={accounts}
          onCancel={() => setEditing(null)}
          onSaved={(message) => {
            showNotice(message);
            setEditing(null);
            reload();
          }}
        />
      </Dialog>
      <Dialog
        open={contributing !== null}
        onClose={() => setContributing(null)}
        title={t("Mover dinero · {name}", { name: contributing?.name ?? "" })}
        description={t("Registra cuánto apartaste para esta meta, o cuánto sacaste de ella.")}
      >
        {contributing ? (
          <ContributionFormBody
            goal={contributing}
            accounts={accounts}
            currency={settings.currency}
            onCancel={() => setContributing(null)}
            onSaved={(message) => {
              showNotice(message);
              setContributing(null);
              reload();
            }}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={trending !== null}
        onClose={() => setTrending(null)}
        title={t("Tendencia · {name}", { name: trending?.name ?? "" })}
        description={t(
          "Sin fecha límite, mira cuánto tendrías con el tiempo a tu ritmo o con el monto que elijas.",
        )}
      >
        {trending ? <GoalTrend goal={trending} currency={settings.currency} /> : null}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title={t("Eliminar meta")}
        message={t(
          "¿Eliminar «{name}»? Se pierde el registro de lo ahorrado. Esta acción no se puede deshacer.",
          { name: deleting?.name ?? "" },
        )}
        confirmLabel={t("Eliminar")}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function GoalCard({
  goal,
  currency,
  period,
  accountLabel,
  onContribute,
  onTrend,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  currency: string;
  period: Frequency;
  /** Where the goal's money is kept; empty with a single account */
  accountLabel: string;
  onContribute: () => void;
  /** Goals without a due date: how much they will have over time */
  onTrend: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const money = (value: string) => formatMoney(value, currency);
  const openEnded = goal.due_date === null && !goal.completed;
  const percent = Math.min(goal.progress_percent, 100);
  const words = PERIOD_WORDS[period];

  let status: { icon: typeof CheckCircle2 | null; text: string };
  if (goal.completed) {
    status = { icon: CheckCircle2, text: t("¡Meta cumplida!") };
  } else if (goal.overdue) {
    status = {
      icon: AlertTriangle,
      text: t("La fecha ya pasó. Te faltan {amount}.", { amount: money(goal.remaining) }),
    };
  } else if (goal.suggested_per_period && goal.periods_left && goal.due_date) {
    const periods =
      goal.periods_left === 1 ? t(words.current) : t(words.many, { n: goal.periods_left });
    status = {
      icon: null,
      text: t("Aparta {amount} por {one} ({periods}) para llegar el {date}.", {
        amount: money(goal.suggested_per_period),
        one: t(words.one),
        periods,
        date: formatDate(goal.due_date, { day: "numeric", month: "long" }),
      }),
    };
  } else if (openEnded && goal.pace_per_week !== null && Number(goal.pace_per_week) > 0) {
    // No deadline: say when the user's own pace gets them there
    const { reachDate } = projectGoal({
      saved: Number(goal.saved_amount),
      target: Number(goal.target_amount),
      weekly: Number(goal.pace_per_week),
      unit: "week",
    });
    status = {
      icon: null,
      text: reachDate
        ? t("Te faltan {amount}. A tu ritmo la alcanzas hacia el {date}.", {
            amount: money(goal.remaining),
            date: formatDate(reachDate, { day: "numeric", month: "long", year: "numeric" }),
          })
        : t("Te faltan {amount}.", { amount: money(goal.remaining) }),
    };
  } else {
    status = { icon: null, text: t("Te faltan {amount}.", { amount: money(goal.remaining) }) };
  }
  const StatusIcon = status.icon;

  return (
    <article
      aria-labelledby={`goal-${goal.id}`}
      className="flex h-full flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id={`goal-${goal.id}`} className="font-display text-xl font-bold">
            {goal.name}
          </h2>
          {accountLabel ? (
            <span className="text-muted text-[13px] font-semibold">
              {t("Guardada en {account}", { account: accountLabel })}
            </span>
          ) : null}
        </div>
        <RowActions
          label={t("la meta {name}", { name: goal.name })}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
      <p className="text-body text-sm">
        {rich(
          t("<b>{saved}</b> de {target}", {
            saved: money(goal.saved_amount),
            target: money(goal.target_amount),
          }),
          {
            b: (text) => (
              <span key="b" className="font-display text-ink text-2xl font-extrabold tabular-nums">
                {text}
              </span>
            ),
          },
        )}
      </p>
      <div
        role="meter"
        aria-label={t("Progreso de {name}", { name: goal.name })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={t("{percent}% ahorrado", { percent: goal.progress_percent })}
        className="bg-canvas h-3.5 overflow-hidden rounded-full"
      >
        <div
          className={`meter-fill h-full rounded-full ${goal.completed ? "bg-mint-ink" : "bg-primary"}`}
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0 round 999px)` }}
        />
      </div>
      <p className="flex items-start gap-2 text-sm font-semibold">
        {StatusIcon ? <StatusIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
        <span>
          {goal.progress_percent}% · {status.text}
        </span>
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContribute}
          // Explicit name: an sr-only suffix loses its leading space in the computed name
          aria-label={t("Aportar o retirar en {name}", { name: goal.name })}
          className={buttonClass("ink", "md")}
        >
          {t("Aportar o retirar")}
        </button>
        {openEnded ? (
          <button
            type="button"
            onClick={onTrend}
            aria-label={t("Ver la tendencia de {name}", { name: goal.name })}
            className={buttonClass("ghost", "md", "border-line border-2")}
          >
            <LineChart aria-hidden="true" className="size-4" />
            {t("Ver tendencia")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function GoalFormBody({
  item,
  accounts,
  onCancel,
  onSaved,
}: {
  item: SavingsGoal | null;
  accounts: Account[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useT();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoalForm, unknown, GoalValues>({
    resolver: zodResolver(goalSchema),
    mode: "onBlur",
    defaultValues: {
      name: item?.name ?? "",
      target_amount: item?.target_amount ?? "",
      saved_amount: item?.saved_amount ?? "0",
      due_date: item?.due_date ?? "",
      // New goals default to the first savings account, else the primary one
      account_id:
        item?.account_id ??
        (accounts.find((a) => a.kind === "savings") ?? accounts.find((a) => a.is_primary))?.id ??
        "",
    },
  });

  async function onSubmit(values: GoalValues) {
    setServerError(null);
    try {
      if (item) {
        await financeApi.updateGoal(item.id, values);
        onSaved(msg("Meta actualizada."));
      } else {
        await financeApi.createGoal(values);
        onSaved(msg("Meta creada."));
      }
    } catch (error) {
      setServerError(apiMessage(error, msg("No pudimos guardar la meta.")));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="goal-name"
          label={t("¿Para qué ahorras?")}
          placeholder={t("Laptop, viaje…")}
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          id="goal-target"
          label={t("Meta")}
          inputMode="decimal"
          placeholder="600.00"
          autoComplete="off"
          error={errors.target_amount?.message}
          {...register("target_amount")}
        />
        <TextField
          id="goal-saved"
          label={t("Ya tengo ahorrado")}
          inputMode="decimal"
          autoComplete="off"
          error={errors.saved_amount?.message}
          {...register("saved_amount")}
        />
        <TextField
          id="goal-due"
          label={t("Fecha objetivo (opcional)")}
          type="date"
          error={errors.due_date?.message}
          {...register("due_date")}
        />
        {accounts.length > 1 ? (
          <SelectField
            id="goal-account"
            label={t("¿Dónde guardas este dinero?")}
            options={accountOptions(accounts, t)}
            {...register("account_id")}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
          {t("Cancelar")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={buttonClass("primary", "md", "font-extrabold")}
        >
          {isSubmitting ? t("Guardando…") : t("Guardar meta")}
        </button>
      </div>
    </form>
  );
}

function ContributionFormBody({
  goal,
  accounts,
  currency,
  onCancel,
  onSaved,
}: {
  goal: SavingsGoal;
  accounts: Account[];
  currency: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useT();
  const [serverError, setServerError] = useState<string | null>(null);
  // Money can move only when the goal lives in an account and there is another one
  const sources = goal.account_id ? accounts.filter((a) => a.id !== goal.account_id) : [];
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContributionForm, unknown, { amount: string; fromAccountId: string | null }>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      direction: "deposit",
      amount: "",
      // By default the money comes from (or returns to) the day-to-day account
      from_account_id: sources.find((a) => a.is_primary)?.id ?? sources[0]?.id ?? "",
    },
  });
  const direction = useWatch({ control, name: "direction" });

  async function onSubmit({
    amount,
    fromAccountId,
  }: {
    amount: string;
    fromAccountId: string | null;
  }) {
    setServerError(null);
    try {
      const updated = await financeApi.contribute(goal.id, amount, fromAccountId);
      onSaved(
        updated.completed
          ? t("¡Cumpliste la meta «{name}»!", { name: goal.name })
          : t("Ahora tienes {amount} en «{name}».", {
              amount: formatMoney(updated.saved_amount, currency),
              name: goal.name,
            }),
      );
    } catch (error) {
      setServerError(apiMessage(error, msg("No pudimos registrar el movimiento.")));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">{t("¿Qué quieres hacer?")}</legend>
        <div className="bg-canvas grid grid-cols-2 gap-1.5 rounded-full p-[5px]">
          {(
            [
              ["deposit", "Aportar"],
              ["withdraw", "Retirar"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`has-[:focus-visible]:outline-focus flex min-h-11 cursor-pointer items-center justify-center rounded-full text-[15px] font-bold transition-colors duration-200 has-[:focus-visible]:outline-3 ${
                direction === value ? "bg-ink text-white" : "hover:bg-ink/5"
              }`}
            >
              <input type="radio" value={value} className="sr-only" {...register("direction")} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        id="contribution-amount"
        label={t("Monto")}
        inputMode="decimal"
        placeholder="0.00"
        autoComplete="off"
        hint={t("Llevas {amount} de {amount2}.", {
          amount: formatMoney(goal.saved_amount, currency),
          amount2: formatMoney(goal.target_amount, currency),
        })}
        error={errors.amount?.message}
        {...register("amount")}
      />
      {sources.length > 0 ? (
        <SelectField
          id="contribution-source"
          label={direction === "withdraw" ? t("¿A qué cuenta vuelve?") : t("¿De qué cuenta sale?")}
          options={[
            ...accountOptions(sources, t),
            { value: "", label: t("Solo registrarlo, sin mover dinero") },
          ]}
          {...register("from_account_id")}
        />
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
          {t("Cancelar")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={buttonClass("primary", "md", "font-extrabold")}
        >
          {isSubmitting ? t("Guardando…") : direction === "withdraw" ? t("Retirar") : t("Aportar")}
        </button>
      </div>
    </form>
  );
}
