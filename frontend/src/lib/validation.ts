/**
 * Form validation. It mirrors the backend rules for instant feedback, but the
 * backend is the authority: it validates everything again (and also rejects
 * common passwords and passwords containing your name or email).
 */
import { z } from "zod";
import { msg, type Vars } from "@/i18n/translate";

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export type PasswordRule = {
  id: string;
  /** Spanish text, translated where it is shown (with `vars`) */
  label: string;
  vars?: Vars;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: msg("{min} caracteres o más"),
    vars: { min: PASSWORD_MIN },
    test: (p) => p.length >= PASSWORD_MIN,
  },
  { id: "upper", label: msg("Una letra mayúscula"), test: (p) => /\p{Lu}/u.test(p) },
  { id: "lower", label: msg("Una letra minúscula"), test: (p) => /\p{Ll}/u.test(p) },
  { id: "digit", label: msg("Un número"), test: (p) => /\p{Nd}/u.test(p) },
  // Anything that is not a letter or digit counts, so ¡ ¿ € work too
  {
    id: "symbol",
    label: msg("Un símbolo (por ejemplo ! ? # -)"),
    test: (p) => /[^\p{L}\p{N}]/u.test(p),
  },
];

const email = z
  .string()
  .trim()
  .min(1, { error: msg("Escribe tu correo electrónico.") })
  .pipe(z.email({ error: msg("Escribe un correo válido, por ejemplo ana@correo.com.") }));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: msg("Escribe tu contraseña.") }),
});

const newPassword = z
  .string()
  .max(PASSWORD_MAX, { error: msg("La contraseña puede tener hasta 128 caracteres.") })
  .refine((p) => PASSWORD_RULES.every((rule) => rule.test(p)), {
    error: msg("La contraseña aún no cumple todos los requisitos."),
  });

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: msg("Escribe tu nombre.") })
      .max(100, { error: msg("Tu nombre puede tener hasta 100 caracteres.") }),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, { error: msg("Repite tu contraseña.") }),
    // Consent must be an explicit, unticked-by-default choice (Ley 81 de 2019)
    acceptTerms: z.boolean().refine((accepted) => accepted, {
      error: msg("Debes aceptar los Términos y la Política de privacidad para crear tu cuenta."),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: msg("Las contraseñas no coinciden."),
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    // Spaces are forgiven ("123 456" as some mail apps show it)
    code: z
      .string()
      .transform((value) => value.replace(/\s/g, ""))
      .pipe(z.string().regex(/^\d{6}$/, { error: msg("Escribe los 6 números del código.") })),
    password: newPassword,
    confirmPassword: z.string().min(1, { error: msg("Repite tu contraseña.") }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: msg("Las contraseñas no coinciden."),
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordValues = z.output<typeof resetPasswordSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
