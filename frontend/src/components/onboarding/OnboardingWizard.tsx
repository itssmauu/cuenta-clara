"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSessionLoader } from "@/components/app/session";
import { PERIOD_ADJECTIVE } from "@/components/dashboard/period-labels";
import { FormAlert } from "@/components/ui/FormAlert";
import { Logo } from "@/components/ui/Logo";
import { ApiError } from "@/lib/api";
import { financeApi } from "@/lib/finance-api";
import type { FixedExpenseValues } from "@/lib/finance-validation";
import { todayISO } from "@/lib/format";

import {
  BalanceStep,
  FixedExpensesStep,
  IncomeStep,
  LimitStep,
  type IncomeStepForm,
  type IncomeStepValues,
} from "./steps";

const STEPS = [
  { title: "Tu monto inicial", intro: "La base de todos los cálculos." },
  { title: "Tus gastos fijos", intro: "Lo que pagas sí o sí: internet, datos, pasaje…" },
  { title: "Tus ingresos", intro: "Cuánto recibes y cada cuánto." },
  { title: "Tu límite de gasto", intro: "Para saber si vas dentro o por encima." },
];

export function OnboardingWizard() {
  const router = useRouter();
  const { state } = useSessionLoader("onboarding");
  const [today] = useState(todayISO);
  const [step, setStep] = useState(0);
  const [balance, setBalance] = useState("");
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseValues[]>([]);
  const [income, setIncome] = useState<IncomeStepForm>({
    frequency: "weekly",
    custom_period_days: "",
    label: "",
    amount: "",
    start_date: today,
  });
  const [incomeValues, setIncomeValues] = useState<IncomeStepValues | null>(null);
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // How many items were already saved, so a retry after a failure never duplicates them
  const saved = useRef({ fixed: 0, income: false });
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Move focus to the new step's title so screen readers announce the change
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  async function finish(spendingLimit: string) {
    if (!incomeValues) return;
    setLimit(spendingLimit);
    setSaving(true);
    setError(null);
    try {
      for (; saved.current.fixed < fixedExpenses.length; saved.current.fixed++) {
        const item = fixedExpenses[saved.current.fixed]!;
        await financeApi.createFixedExpense({ ...item, start_date: today });
      }
      const custom =
        incomeValues.frequency === "custom" ? Number(incomeValues.custom_period_days) : null;
      if (incomeValues.amount && !saved.current.income) {
        await financeApi.createIncome({
          label: incomeValues.label || "Ingreso principal",
          amount: incomeValues.amount,
          frequency: incomeValues.frequency,
          custom_period_days: custom,
          start_date: incomeValues.start_date,
        });
        saved.current.income = true;
      }
      await financeApi.saveSettings({
        initial_balance: balance,
        balance_as_of: today,
        currency: "USD",
        income_period: incomeValues.frequency,
        custom_period_days: custom,
        spending_limit: spendingLimit || null,
        onboarding_completed: true,
      });
      router.replace("/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? `No pudimos guardar todo: ${caught.message} Inténtalo de nuevo.`
          : "No pudimos guardar tus datos. Inténtalo de nuevo.",
      );
      setSaving(false);
    }
  }

  if (state.status === "error") {
    return <FormAlert title={state.message} />;
  }
  if (state.status === "loading") {
    return (
      <p role="status" className="text-muted font-semibold">
        Cargando…
      </p>
    );
  }

  const current = STEPS[step]!;

  return (
    <div className="flex flex-col gap-6">
      <Logo />
      <div className="flex flex-col gap-6 rounded-[32px] bg-white p-6 sm:p-10">
        <p className="text-muted font-semibold">
          Hola, {state.user.name}. Configuremos tu cuenta en 4 pasos.
        </p>

        <ol aria-label="Progreso" className="grid grid-cols-4 gap-2">
          {STEPS.map((s, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li
                key={s.title}
                aria-current={active ? "step" : undefined}
                className="flex flex-col gap-2"
              >
                <span
                  aria-hidden="true"
                  className={`h-2 rounded-full ${done || active ? "bg-primary" : "bg-line"}`}
                />
                <span
                  className={`flex items-center gap-1 text-xs font-bold ${active ? "text-ink" : "text-muted"}`}
                >
                  {done ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
                  <span className="hidden sm:inline">{s.title}</span>
                  <span className="sm:hidden">Paso {index + 1}</span>
                  <span className="sr-only">
                    {done ? " (completado)" : active ? " (actual)" : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-1">
          <p className="text-primary text-sm font-bold">
            Paso {step + 1} de {STEPS.length}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-[28px] font-extrabold tracking-[-0.02em] focus:outline-none"
          >
            {current.title}
          </h1>
          <p className="text-body">{current.intro}</p>
        </div>

        {step === 0 ? (
          <BalanceStep
            initial={balance}
            onNext={(value) => {
              setBalance(value);
              setStep(1);
            }}
          />
        ) : null}
        {step === 1 ? (
          <FixedExpensesStep
            items={fixedExpenses}
            onAdd={(item) => setFixedExpenses((items) => [...items, item])}
            onRemove={(index) => setFixedExpenses((items) => items.filter((_, i) => i !== index))}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        ) : null}
        {step === 2 ? (
          <IncomeStep
            initial={income}
            onBack={() => setStep(1)}
            onNext={(values) => {
              setIncomeValues(values);
              setIncome({ ...values, custom_period_days: values.custom_period_days });
              setStep(3);
            }}
          />
        ) : null}
        {step === 3 ? (
          <LimitStep
            initial={limit}
            periodLabel={PERIOD_ADJECTIVE[incomeValues?.frequency ?? "weekly"]}
            submitting={saving}
            error={error}
            onBack={() => setStep(2)}
            onFinish={finish}
          />
        ) : null}
      </div>
    </div>
  );
}
