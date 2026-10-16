import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, fromAcceptLanguage, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { translator, type Translate } from "./translate";

/** The visitor's language: their choice (cookie), else their browser's, else Spanish. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return fromAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
}

export async function getT(): Promise<Translate> {
  return translator(await getLocale());
}
