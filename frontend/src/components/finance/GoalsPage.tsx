"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, PiggyBank, Plus } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState, Notice, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import { financeApi, type Frequency, type SavingsGoal } from "@/lib/finance-api";
import {
  contributionSchema,
  goalSchema,
  type ContributionForm,
  type GoalForm,
  type GoalValues,
} from "@/lib/finance-validation";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

import { RowActions } from "./RowActions";

const PERIOD_NOUN: Record<Frequency, [string, string]> = {
  daily: ["día", "días"],
  weekly: ["semana", "semanas"],
  biweekly: ["quincena", "quincenas"],
  monthly: ["mes", "meses"],
  custom: ["periodo", "periodos"],
};

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function GoalsPage() {
  const { settings } = useSession();
  const [today] = useState(todayISO);
  const [goals, reload] = useResource(`goals:${today}`, () => financeApi.listGoals(today));
  const [editing, setEditing] = useState<{ item: SavingsGoal | null } | null>(null);
  const [contributing, setContributing] = useState<SavingsGoal | null>(null);
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
      showNotice(`Meta «${deleting.name}» eliminada.`);
      reload();
    } catch (caught) {
      setError(apiMessage(caught, "No pudimos eliminar la meta."));
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
      Nueva meta
    </button>
  );

  return (
    <>
      <PageHeader
        title="Metas de ahorro"
        subtitle="Aparta dinero para lo que quieres"
        actions={addButton}
      />
      <Notice message={notice} />
      {error ? <FormAlert title={error} /> : null}

      {goals.status === "error" && !items ? (
        <FormAlert title="No pudimos cargar tus metas." items={[goals.error.message]} />
      ) : !items ? (
        <TableSkeleton rows={2} />
      ) : items.length === 0 ? (
        <section className="rounded-[32px] bg-white p-6 sm:p-7">
          <EmptyState
            icon={PiggyBank}
            title="Aún no tienes metas de ahorro"
            text="Crea una meta (una laptop, un viaje, un fondo de emergencia) y te diremos cuánto apartar cada periodo para llegar a tiempo."
            action={addButton}
          />
        </section>
      ) : (
        <ul aria-label="Tus metas" className="grid gap-5 md:grid-cols-2">
          {items.map((goal) => (
            <li key={goal.id}>
              <GoalCard
                goal={goal}
                currency={settings.currency}
                period={settings.income_period}
                onContribute={() => setContributing(goal)}
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
        title={editing?.item ? "Editar meta" : "Nueva meta"}
      >
        <GoalFormBody
          item={editing?.item ?? null}
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
        title={`Mover dinero · ${contributing?.name ?? ""}`}
        description="Registra cuánto apartaste para esta meta, o cuánto sacaste de ella."
      >
        {contributing ? (
          <ContributionFormBody
            goal={contributing}
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
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar meta"
        message={`¿Eliminar «${deleting?.name ?? ""}»? Se pierde el registro de lo ahorrado. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
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
  onContribute,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  currency: string;
  period: Frequency;
  onContribute: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const money = (value: string) => formatMoney(value, currency);
  const percent = Math.min(goal.progress_percent, 100);
  const [one, many] = PERIOD_NOUN[period];

  let status: { icon: typeof CheckCircle2 | null; text: string };
  if (goal.completed) {
    status = { icon: CheckCircle2, text: "¡Meta cumplida!" };
  } else if (goal.overdue) {
    status = { icon: AlertTriangle, text: `La fecha ya pasó. Te faltan ${money(goal.remaining)}.` };
  } else if (goal.suggested_per_period && goal.periods_left && goal.due_date) {
    const periods = goal.periods_left === 1 ? `esta ${one}` : `${goal.periods_left} ${many}`;
    status = {
      icon: null,
      text: `Aparta ${money(goal.suggested_per_period)} por ${one} (${periods}) para llegar el ${formatDate(goal.due_date, { day: "numeric", month: "long" })}.`,
    };
  } else {
    status = { icon: null, text: `Te faltan ${money(goal.remaining)}.` };
  }
  const StatusIcon = status.icon;

  return (
    <article
      aria-labelledby={`goal-${goal.id}`}
      className="flex h-full flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={`goal-${goal.id}`} className="font-display text-xl font-bold">
          {goal.name}
        </h2>
        <RowActions label={`la meta ${goal.name}`} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <p className="text-body text-sm">
        <span className="font-display text-ink text-2xl font-extrabold tabular-nums">
          {money(goal.saved_amount)}
        </span>{" "}
        de {money(goal.target_amount)}
      </p>
      <div
        role="meter"
        aria-label={`Progreso de ${goal.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${goal.progress_percent}% ahorrado`}
        className="bg-canvas h-3.5 overflow-hidden rounded-full"
      >
        <div
          className={`h-full rounded-full ${goal.completed ? "bg-mint-ink" : "bg-primary"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="flex items-start gap-2 text-sm font-semibold">
        {StatusIcon ? <StatusIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
        <span>
          {goal.progress_percent}% · {status.text}
        </span>
      </p>
      <button
        type="button"
        onClick={onContribute}
        // Explicit name: an sr-only suffix loses its leading space in the computed name
        aria-label={`Aportar o retirar en ${goal.name}`}
        className={buttonClass("ink", "md", "mt-auto self-start")}
      >
        Aportar o retirar
      </button>
    </article>
  );
}

function GoalFormBody({
  item,
  onCancel,
  onSaved,
}: {
  item: SavingsGoal | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
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
    },
  });

  async function onSubmit(values: GoalValues) {
    setServerError(null);
    try {
      if (item) {
        await financeApi.updateGoal(item.id, values);
        onSaved("Meta actualizada.");
      } else {
        await financeApi.createGoal(values);
        onSaved("Meta creada.");
      }
    } catch (error) {
      setServerError(apiMessage(error, "No pudimos guardar la meta."));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="goal-name"
          label="¿Para qué ahorras?"
          placeholder="Laptop, viaje…"
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          id="goal-target"
          label="Meta"
          inputMode="decimal"
          placeholder="600.00"
          autoComplete="off"
          error={errors.target_amount?.message}
          {...register("target_amount")}
        />
        <TextField
          id="goal-saved"
          label="Ya tengo ahorrado"
          inputMode="decimal"
          autoComplete="off"
          error={errors.saved_amount?.message}
          {...register("saved_amount")}
        />
        <TextField
          id="goal-due"
          label="Fecha objetivo (opcional)"
          type="date"
          error={errors.due_date?.message}
          {...register("due_date")}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={buttonClass("primary", "md", "font-extrabold")}
        >
          {isSubmitting ? "Guardando…" : "Guardar meta"}
        </button>
      </div>
    </form>
  );
}

function ContributionFormBody({
  goal,
  currency,
  onCancel,
  onSaved,
}: {
  goal: SavingsGoal;
  currency: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContributionForm, unknown, string>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { direction: "deposit", amount: "" },
  });
  const direction = useWatch({ control, name: "direction" });

  async function onSubmit(signedAmount: string) {
    setServerError(null);
    try {
      const updated = await financeApi.contribute(goal.id, signedAmount);
      onSaved(
        updated.completed
          ? `¡Cumpliste la meta «${goal.name}»!`
          : `Ahora tienes ${formatMoney(updated.saved_amount, currency)} en «${goal.name}».`,
      );
    } catch (error) {
      setServerError(apiMessage(error, "No pudimos registrar el movimiento."));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">¿Qué quieres hacer?</legend>
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
        label="Monto"
        inputMode="decimal"
        placeholder="0.00"
        autoComplete="off"
        hint={`Llevas ${formatMoney(goal.saved_amount, currency)} de ${formatMoney(goal.target_amount, currency)}.`}
        error={errors.amount?.message}
        {...register("amount")}
      />
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={buttonClass("primary", "md", "font-extrabold")}
        >
          {isSubmitting ? "Guardando…" : direction === "withdraw" ? "Retirar" : "Aportar"}
        </button>
      </div>
    </form>
  );
}
