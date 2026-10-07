"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormAlert } from "@/components/ui/FormAlert";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { ApiError, authApi } from "@/lib/api";
import { registerSchema, type RegisterValues } from "@/lib/validation";

type ServerError = { title: string; items?: string[] };

// Registration never says whether an email already had an account (see docs/decisions.md
// D-015), so if the follow-up login fails we can only suggest both possibilities.
const ACCOUNT_NOT_READY =
  "No pudimos entrar con esos datos. Si ya tenías una cuenta con este correo, inicia sesión con tu contraseña.";

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" });

  async function onSubmit({ name, email, password }: RegisterValues) {
    setServerError(null);
    try {
      await authApi.register({ name, email, password });
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError({ title: error.message, items: error.problems });
      } else {
        setServerError({ title: "No pudimos crear tu cuenta." });
      }
      return;
    }

    try {
      await authApi.login({ email, password });
      router.push("/dashboard");
    } catch {
      setServerError({ title: ACCOUNT_NOT_READY });
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="stagger-in flex flex-col gap-[18px]"
    >
      {serverError ? (
        <div className="motion-safe:animate-[shake_360ms_ease-in-out]">
          <FormAlert title={serverError.title} items={serverError.items} />
        </div>
      ) : null}

      <TextField
        id="name"
        label="Nombre"
        autoComplete="name"
        placeholder="Tu nombre"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        id="email"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="correo@ejemplo.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordField
        id="password"
        label="Contraseña"
        autoComplete="new-password"
        error={errors.password?.message}
        hint={<PasswordChecklist id="password-rules" password={password} />}
        {...register("password")}
      />
      <PasswordField
        id="confirmPassword"
        label="Confirmar contraseña"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <SubmitButton busy={isSubmitting} label="Crear cuenta" busyLabel="Creando tu cuenta…" />
    </form>
  );
}
