// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EN, EN_PATTERNS } from "./en";
import { fromAcceptLanguage } from "./config";
import { rich, translate } from "./translate";

const SRC = path.resolve(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Every literal passed to t("…") or msg("…") anywhere in the app. */
export function textsInCode(): Map<string, string> {
  const found = new Map<string, string>();
  const call = /\b(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"/g;
  for (const file of sourceFiles(SRC)) {
    const code = readFileSync(file, "utf-8");
    for (const match of code.matchAll(call)) {
      const text = JSON.parse(`"${match[1]}"`) as string;
      if (!found.has(text)) found.set(text, path.relative(SRC, file));
    }
  }
  return found;
}

describe("translations", () => {
  it("has an English text for every text in the code", () => {
    const missing = [...textsInCode()].filter(([text]) => !(text in EN));
    expect(missing.map(([text, file]) => `${file}: ${text}`)).toEqual([]);
  });

  it("keeps the same {placeholders} in both languages", () => {
    const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const broken = Object.entries(EN).filter(([es, en]) => names(es).join() !== names(en).join());
    expect(broken).toEqual([]);
  });

  it("keeps the same <tags> in both languages", () => {
    const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();
    const broken = Object.entries(EN).filter(([es, en]) => tags(es).join() !== tags(en).join());
    expect(broken).toEqual([]);
  });

  it("translates, interpolates and falls back to Spanish", () => {
    expect(translate("es", "Hola, {name}", { name: "Ana" })).toBe("Hola, Ana");
    expect(translate("en", "texto que no existe")).toBe("texto que no existe");
    for (const [pattern] of EN_PATTERNS) expect(pattern.flags).not.toContain("g");
  });

  it("renders tags inside a sentence", () => {
    const out = rich("Lee los <terms>Términos</terms> hoy", { terms: (c) => `[${c}]` });
    expect(out.join("")).toBe("Lee los [Términos] hoy");
  });

  it("reads the browser's preferred language", () => {
    expect(fromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(fromAcceptLanguage("fr-FR,es;q=0.8")).toBe("es");
    expect(fromAcceptLanguage("de-DE")).toBeNull();
  });
});
