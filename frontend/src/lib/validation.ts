/**
 * Form validation. It mirrors the backend rules for instant feedback, but the
 * backend is the authority: it validates everything again (and also rejects
 * common passwords and passwords containing your name or email).
 */
import { z } from "zod";

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export type PasswordRule = { id: string; label: string; test: (password: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN} caracteres o más`,
    test: (p) => p.length >= PASSWORD_MIN,
  },
  { id: "upper", label: "Una letra mayúscula", test: (p) => /\p{Lu}/u.test(p) },
  { id: "lower", label: "Una letra minúscula", test: (p) => /\p{Ll}/u.test(p) },
  { id: "digit", label: "Un número", test: (p) => /\p{Nd}/u.test(p) },
  // Anything that is not a letter or digit counts, so ¡ ¿ € work too
  {
    id: "symbol",
    label: "Un símbolo (por ejemplo ! ? # -)",
    test: (p) => /[^\p{L}\p{N}]/u.test(p),
  },
];

const email = z
  .string()
  .trim()
  .min(1, { error: "Escribe tu correo electrónico." })
  .pipe(z.email({ error: "Escribe un correo válido, por ejemplo ana@correo.com." }));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Escribe tu contraseña." }),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Escribe tu nombre." })
      .max(100, { error: "Tu nombre puede tener hasta 100 caracteres." }),
    email,
    password: z
      .string()
      .max(PASSWORD_MAX, { error: `La contraseña puede tener hasta ${PASSWORD_MAX} caracteres.` })
      .refine((p) => PASSWORD_RULES.every((rule) => rule.test(p)), {
        error: "La contraseña aún no cumple todos los requisitos.",
      }),
    confirmPassword: z.string().min(1, { error: "Repite tu contraseña." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
