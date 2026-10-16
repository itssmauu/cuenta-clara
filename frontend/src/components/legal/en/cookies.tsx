import Link from "next/link";

import { COOKIE_NOTICE_KEY } from "@/components/legal/CookieNotice";
import type { LegalSection } from "@/components/legal/LegalDocument";
import { ScrollRegion } from "@/components/ui/ScrollRegion";
import { LEGAL } from "@/lib/legal";

const cookies = [
  {
    name: "access_token",
    purpose: "Keeps you signed in. Scripts can’t read it (HttpOnly).",
    duration: "15 minutes",
  },
  {
    name: "refresh_token",
    purpose:
      "Renews your session without asking for your password again. HttpOnly and limited to the authentication path.",
    duration: "7 days or until you sign out",
  },
  {
    name: "csrf_token",
    purpose: "Protects your forms against requests forged from other websites (CSRF).",
    duration: "7 days or until you sign out",
  },
];

/** English translation of /legal/cookies. The Spanish version prevails. */
export const cookiesEn = {
  title: "Cookie policy",
  description: "Which cookies Cuenta Clara uses and what for.",
  summary: [
    "We only use technical cookies, essential to sign in and protect you.",
    "We don’t use analytics, advertising or tracking cookies, or third-party cookies.",
    "That is why we don’t ask you to choose cookies: without these, you couldn’t sign in to your account.",
  ],
  sections: [
    {
      id: "que-son",
      title: "What cookies are",
      body: (
        <p>
          Cookies are small files that a website stores in your browser. They are used, for example,
          to remember that you already signed in.
        </p>
      ),
    },
    {
      id: "cuales",
      title: "Which cookies we use",
      body: (
        <>
          <p>
            They are all our own, secure session cookies (they only travel over HTTPS and never to
            other websites) and strictly necessary:
          </p>
          <ScrollRegion label="Cookies table">
            <table>
              <thead>
                <tr>
                  <th scope="col">COOKIE</th>
                  <th scope="col">WHAT IT’S FOR</th>
                  <th scope="col">DURATION</th>
                </tr>
              </thead>
              <tbody>
                {cookies.map((cookie) => (
                  <tr key={cookie.name}>
                    <td>
                      <code className="text-ink font-bold">{cookie.name}</code>
                    </td>
                    <td>{cookie.purpose}</td>
                    <td className="whitespace-nowrap">{cookie.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </>
      ),
    },
    {
      id: "almacenamiento",
      title: "Browser local storage",
      body: (
        <p>
          We also keep in your browser’s local storage (<code>{COOKIE_NOTICE_KEY}</code>) that you
          already closed the cookie notice, so we don’t show it to you every time, and the language
          you chose is remembered in a cookie of its own (<code>cc-lang</code>). Neither contains
          personal data. The conversation with Balbo isn’t stored anywhere: it’s erased when you
          reload.
        </p>
      ),
    },
    {
      id: "terceros",
      title: "Third-party cookies",
      body: (
        <p>
          We don’t use any: no Google Analytics, no social media pixels, no advertising. Fonts are
          served from our own server, without calling third parties.
        </p>
      ),
    },
    {
      id: "control",
      title: "How to control them",
      body: (
        <p>
          You can delete or block cookies from your browser settings. If you block those of{" "}
          {LEGAL.service}, you won’t be able to sign in. When you sign out, the three session
          cookies are deleted.
        </p>
      ),
    },
    {
      id: "cambios",
      title: "Changes",
      body: (
        <p>
          If we ever add cookies that aren’t essential, we will ask for your permission before using
          them and update this page. More details about your data in the{" "}
          <Link href="/legal/privacidad">Privacy policy</Link>.
        </p>
      ),
    },
  ] satisfies LegalSection[],
};
