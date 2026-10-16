import type { ReactNode } from "react";

import type { Locale } from "./config";
import { EN, EN_PATTERNS } from "./en";

export type Vars = Record<string, string | number>;

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * The text in `locale`. Spanish is the key, so Spanish is returned as is; English comes
 * from the dictionary. Messages built elsewhere (the API, with names or dates inside)
 * are matched by pattern. Anything unknown stays in Spanish rather than breaking.
 */
export function translate(locale: Locale, text: string, vars?: Vars): string {
  if (locale === "es" || !text) return interpolate(text, vars);
  const exact = EN[text];
  if (exact !== undefined) return interpolate(exact, vars);
  for (const [pattern, english] of EN_PATTERNS) {
    if (pattern.test(text)) return text.replace(pattern, english);
  }
  return interpolate(text, vars);
}

/**
 * Marks Spanish text that is stored or passed around (validation messages, labels in
 * constant maps) and translated where it is shown. It returns the text unchanged; the
 * i18n test reads these marks to require an English version.
 */
export function msg(text: string): string {
  return text;
}

export type Translate = (text: string, vars?: Vars) => string;

export function translator(locale: Locale): Translate {
  return (text, vars) => translate(locale, text, vars);
}

/**
 * Sentences with links or emphasis inside: "Acepto los <terms>Términos</terms>".
 * Each <tag>…</tag> in the translated text is rendered by `tags[tag]`, so word order can
 * change between languages without splitting the sentence.
 */
export function rich(
  translated: string,
  tags: Record<string, (children: string) => ReactNode>,
): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  for (const match of translated.matchAll(pattern)) {
    const [whole, tag, inner] = match;
    out.push(translated.slice(last, match.index));
    const render = tags[tag!];
    out.push(render ? render(inner!) : inner);
    last = match.index! + whole.length;
  }
  out.push(translated.slice(last));
  return out;
}
