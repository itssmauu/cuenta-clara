"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/ui/FormAlert";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { ApiError, authApi } from "@/lib/api";
import { loginSchema, type LoginValues } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    try {
      await authApi.login(values);
      router.push("/dashboard");
    } catch (error) {
      // The API already words these generically (it never says whether the email exists)
      setServerError(error instanceof ApiError ? error.message : "No pudimos iniciar sesión.");
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="stagger-in flex flex-col gap-[18px]"
    >
      {/* A short shake says "no" before the words do */}
      {serverError ? (
        <div className="motion-safe:animate-[shake_360ms_ease-in-out]">
          <FormAlert title={serverError} />
        </div>
      ) : null}

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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Link
        href="/recuperar-contrasena"
        className="text-primary inline-flex min-h-11 items-center self-start text-sm font-bold hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </Link>

      <SubmitButton busy={isSubmitting} label="Entrar" busyLabel="Entrando…" />
    </form>
  );
}
