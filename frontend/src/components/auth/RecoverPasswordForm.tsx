"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormAlert } from "@/components/ui/FormAlert";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useT } from "@/i18n/client";
import { msg, rich } from "@/i18n/translate";
import { ApiError, authApi } from "@/lib/api";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordValues,
  type ResetPasswordInput,
  type ResetPasswordValues,
} from "@/lib/validation";

// Before "send it again" unlocks: enough for the first email to arrive
export const RESEND_SECONDS = 60;

type ServerError = { title: string; items?: string[] };

function toServerError(error: unknown, fallback: string): ServerError {
  return error instanceof ApiError
    ? { title: error.message, items: error.problems }
    : { title: fallback };
}

/**
 * Forgotten password, in two steps: ask for a 6-digit code by email, then type it with
 * the new password. The first step never says whether the email has an account.
 */
export function RecoverPasswordForm() {
  const [email, setEmail] = useState<string | null>(null);

  return email === null ? (
    <EmailStep onSent={setEmail} />
  ) : (
    <CodeStep email={email} onChangeEmail={() => setEmail(null)} />
  );
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const t = useT();
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  async function onSubmit({ email }: ForgotPasswordValues) {
    setServerError(null);
    try {
      await authApi.forgotPassword(email);
      onSent(email);
    } catch (error) {
      setServerError(toServerError(error, msg("No pudimos enviar el código. Inténtalo de nuevo.")));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]">
      <p className="text-body leading-relaxed">
        {t(
          "Escribe el correo de tu cuenta y te enviaremos un código de 6 números para crear una contraseña nueva.",
        )}
      </p>
      {serverError ? <FormAlert title={serverError.title} /> : null}
      <TextField
        id="email"
        label={t("Correo electrónico")}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder={t("correo@ejemplo.com")}
        error={errors.email?.message}
        {...register("email")}
      />
      <SubmitButton
        busy={isSubmitting}
        label={t("Enviarme un código")}
        busyLabel={t("Enviando…")}
      />
      <Link
        href="/login"
        className="text-primary inline-flex min-h-11 items-center self-center text-sm font-bold hover:underline"
      >
        {t("Volver a iniciar sesión")}
      </Link>
    </form>
  );
}

function CodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const t = useT();
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerError | null>(null);
  // An end time, not a counter: background tabs slow timers down, the clock does not
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const [resent, setResent] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput, unknown, ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { code: "", password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" });

  // Keyboard and screen reader users land on what just happened
  useEffect(() => headingRef.current?.focus(), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function resend() {
    setServerError(null);
    try {
      await authApi.forgotPassword(email);
      setResent(true);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
    } catch (error) {
      setServerError(toServerError(error, msg("No pudimos reenviar el código.")));
    }
  }

  async function onSubmit({ code, password }: ResetPasswordValues) {
    setServerError(null);
    try {
      await authApi.resetPassword({ email, code, new_password: password });
    } catch (error) {
      setServerError(toServerError(error, msg("No pudimos cambiar tu contraseña.")));
      return;
    }
    // Every other session was closed; this one starts fresh with the new password
    try {
      await authApi.login({ email, password });
      router.push("/dashboard");
    } catch {
      router.push("/login");
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]">
      <div className="bg-primary-tint text-on-tint flex gap-3 rounded-2xl p-4 text-sm leading-relaxed">
        <MailCheck aria-hidden="true" className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 ref={headingRef} tabIndex={-1} className="text-ink font-bold outline-none">
            {t("Revisa tu correo")}
          </h2>
          <p>
            {rich(
              t(
                "Si <email></email> tiene una cuenta, te enviamos un código de 6 números. Vence en 15 minutos. Si no lo ves, busca en spam.",
              ),
              {
                email: () => (
                  <strong key="email" className="text-ink break-all">
                    {email}
                  </strong>
                ),
              },
            )}
          </p>
          {resent ? (
            <p role="status">{t("Te enviamos un código nuevo; el anterior ya no sirve.")}</p>
          ) : null}
        </div>
      </div>

      {serverError ? <FormAlert title={serverError.title} items={serverError.items} /> : null}

      <TextField
        id="code"
        label={t("Código de 6 números")}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="123456"
        className="tracking-[0.3em]"
        error={errors.code?.message}
        {...register("code")}
      />
      <PasswordField
        id="password"
        label={t("Contraseña nueva")}
        autoComplete="new-password"
        error={errors.password?.message}
        hint={<PasswordChecklist id="password-rules" password={password ?? ""} />}
        {...register("password")}
      />
      <PasswordField
        id="confirmPassword"
        label={t("Confirmar contraseña nueva")}
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <SubmitButton
        busy={isSubmitting}
        label={t("Cambiar contraseña")}
        busyLabel={t("Cambiando…")}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={resendIn > 0}
          className="text-primary disabled:text-muted inline-flex min-h-11 cursor-pointer items-center hover:underline disabled:cursor-not-allowed disabled:no-underline"
        >
          {resendIn > 0
            ? t("Reenviar código en {seconds} s", { seconds: resendIn })
            : t("Reenviar código")}
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="text-body hover:text-ink inline-flex min-h-11 cursor-pointer items-center"
        >
          {t("Usar otro correo")}
        </button>
      </div>
    </form>
  );
}
