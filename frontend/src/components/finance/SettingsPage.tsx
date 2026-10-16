"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { Notice, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { useT } from "@/i18n/client";
import { msg } from "@/i18n/translate";
import { ApiError } from "@/lib/api";
import { financeApi } from "@/lib/finance-api";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  settingsSchema,
  type SettingsForm,
  type SettingsValues,
} from "@/lib/finance-validation";

import { CategoriesSection } from "./CategoriesSection";
import { PrivacySection } from "./PrivacySection";

const CURRENCIES = [
  { value: "USD", label: msg("Dólar estadounidense (USD)") },
  { value: "PAB", label: msg("Balboa panameño (PAB)") },
  { value: "EUR", label: msg("Euro (EUR)") },
  { value: "MXN", label: msg("Peso mexicano (MXN)") },
  { value: "COP", label: msg("Peso colombiano (COP)") },
  { value: "CRC", label: msg("Colón costarricense (CRC)") },
];

export function SettingsPage() {
  const t = useT();
  const { user, settings, setSettings } = useSession();
  const [notice, showNotice] = useNotice();

  return (
    <>
      <PageHeader
        title={t("Configuración")}
        subtitle={t("Tu punto de partida, tu periodo y tus categorías")}
      />
      <Notice message={notice} />
      <FinanceSettings
        key={JSON.stringify(settings)}
        onSaved={(updated) => {
          setSettings(updated);
          showNotice(msg("Configuración guardada."));
        }}
      />
      <CategoriesSection onNotice={showNotice} />
      <section
        aria-labelledby="account-title"
        className="flex flex-col gap-3 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <h2 id="account-title" className="font-display text-xl font-bold">
          {t("Tu cuenta")}
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted font-semibold">{t("Nombre")}</dt>
            <dd className="font-bold">{user.name}</dd>
          </div>
          <div>
            <dt className="text-muted font-semibold">{t("Correo")}</dt>
            <dd className="font-bold break-all">{user.email}</dd>
          </div>
        </dl>
      </section>
      <PrivacySection onNotice={showNotice} />
    </>
  );
}

function FinanceSettings({
  onSaved,
}: {
  onSaved: (settings: Awaited<ReturnType<typeof financeApi.saveSettings>>) => void;
}) {
  const t = useT();
  const { settings } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsForm, unknown, SettingsValues>({
    resolver: zodResolver(settingsSchema),
    mode: "onBlur",
    defaultValues: {
      balance_as_of: settings.balance_as_of,
      currency: settings.currency,
      income_period: settings.income_period,
      custom_period_days: settings.custom_period_days ? String(settings.custom_period_days) : "",
      spending_limit: settings.spending_limit ?? "",
    },
  });
  const period = useWatch({ control, name: "income_period" });

  async function onSubmit(values: SettingsValues) {
    setServerError(null);
    try {
      const updated = await financeApi.saveSettings({
        ...values,
        custom_period_days: values.income_period === "custom" ? values.custom_period_days : null,
        spending_limit: values.spending_limit || null,
        onboarding_completed: true,
      });
      onSaved(updated);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : t("No pudimos guardar la configuración."),
      );
    }
  }

  return (
    <section
      aria-labelledby="finance-settings-title"
      className="flex flex-col gap-5 rounded-[32px] bg-white p-6 sm:p-7"
    >
      <h2 id="finance-settings-title" className="font-display text-xl font-bold">
        {t("Tus finanzas")}
      </h2>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {serverError ? <FormAlert title={serverError} /> : null}
        {/* Each account has its own starting balance now */}
        <p className="bg-canvas text-body flex flex-wrap items-center gap-2 rounded-2xl p-4 text-sm font-semibold">
          <Landmark aria-hidden="true" className="text-primary size-5 shrink-0" />
          {t("El saldo inicial de cada cuenta se cambia en")}
          <Link
            href="/cuentas"
            className="text-primary inline-flex min-h-6 items-center font-bold hover:underline"
          >
            {t("Cuentas")}
          </Link>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="settings-as-of"
            label={t("¿Desde qué fecha llevas tus cuentas?")}
            type="date"
            hint={t(
              "Los movimientos anteriores a esta fecha no cuentan: ya están en los saldos iniciales.",
            )}
            error={errors.balance_as_of?.message}
            {...register("balance_as_of")}
          />
          <SelectField
            id="settings-currency"
            label={t("Moneda")}
            options={CURRENCIES}
            error={errors.currency?.message}
            {...register("currency")}
          />
          <SelectField
            id="settings-period"
            label={t("Tu periodo")}
            options={FREQUENCIES.map((value) => ({ value, label: FREQUENCY_LABELS[value] }))}
            error={errors.income_period?.message}
            {...register("income_period")}
          />
          {period === "custom" ? (
            <TextField
              id="settings-days"
              label={t("Cada cuántos días")}
              inputMode="numeric"
              error={errors.custom_period_days?.message}
              {...register("custom_period_days")}
            />
          ) : null}
          <TextField
            id="settings-limit"
            label={t("Límite de gasto por periodo (opcional)")}
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("Sin límite")}
            hint={t("Incluye tus gastos fijos. Déjalo vacío para no usar límite.")}
            error={errors.spending_limit?.message}
            {...register("spending_limit")}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            aria-busy={isSubmitting}
            className={buttonClass("primary", "md", "font-extrabold")}
          >
            {isSubmitting ? t("Guardando…") : t("Guardar cambios")}
          </button>
        </div>
      </form>
    </section>
  );
}
