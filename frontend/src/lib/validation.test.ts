import { describe, expect, it } from "vitest";

import { loginSchema, PASSWORD_RULES, registerSchema } from "./validation";

const STRONG = "Lluvia-Verde-2026!";

function failedRules(password: string) {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.id);
}

describe("password rules (mirror of the backend policy)", () => {
  it("accepts a strong password", () => {
    expect(failedRules(STRONG)).toEqual([]);
  });

  it.each([
    ["Ab1!short", ["length"]],
    ["SOLOMAYUSCULAS123!", ["lower"]],
    ["solominusculas123!", ["upper"]],
    ["SinNumerosAqui!!", ["digit"]],
    ["SinSimbolos2026Aqui", ["symbol"]],
  ])("reports what %s is missing", (password, expected) => {
    expect(failedRules(password)).toEqual(expected);
  });

  it("counts non-ASCII symbols and accented letters", () => {
    expect(failedRules("Ñandú¡Verde¿2026")).toEqual([]);
  });
});

describe("loginSchema", () => {
  it("trims the email", () => {
    const parsed = loginSchema.parse({ email: "  ana@example.com ", password: "x" });
    expect(parsed.email).toBe("ana@example.com");
  });

  it("explains an invalid email", () => {
    const result = loginSchema.safeParse({ email: "ana@", password: "x" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/correo válido/);
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Ana",
    email: "ana@example.com",
    password: STRONG,
    confirmPassword: STRONG,
  };

  it("accepts valid data", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("requires matching passwords, reported on the confirmation field", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "otra" });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden.",
      }),
    ]);
  });

  it("rejects a weak password", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "corta",
      confirmPassword: "corta",
    });
    expect(result.error?.issues[0]?.path).toEqual(["password"]);
  });
});
