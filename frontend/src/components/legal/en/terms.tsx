import Link from "next/link";

import { PrivacyContact, type LegalSection } from "@/components/legal/LegalDocument";
import { LEGAL } from "@/lib/legal";

import { LEGAL_EN } from "./legal-en";

/** English translation of /legal/terminos. The Spanish version prevails. */
export const termsEn = {
  title: "Terms and conditions",
  description: "The conditions for using Cuenta Clara.",
  summary: [
    `${LEGAL.service} is a free tool to organize your personal finances; it is not a bank and does not move money.`,
    `You must be over ${LEGAL.minimumAge} and keep your password safe.`,
    "The figures, forecasts and Balbo’s answers are guidance: they are not professional financial advice.",
    "You can stop using the service and delete your account whenever you want.",
  ],
  sections: [
    {
      id: "quienes-somos",
      title: "Who provides the service",
      body: (
        <>
          <p>
            {LEGAL.service} is a service provided by <strong>{LEGAL.owner}</strong>,{" "}
            {LEGAL_EN.ownerKind}, in the {LEGAL_EN.country}. By creating an account you accept these
            Terms and the <Link href="/legal/privacidad">Privacy policy</Link>.
          </p>
          <PrivacyContact />
        </>
      ),
    },
    {
      id: "servicio",
      title: "What Cuenta Clara is and isn’t",
      body: (
        <>
          <p>
            {LEGAL.service} helps you record your income, expenses, accounts and savings goals, and
            see how much you have left in your period. Everything it shows is calculated from the
            data you enter.
          </p>
          <ul>
            <li>
              It is not a bank or a financial institution, and it does not hold or move money.
            </li>
            <li>It does not connect to your bank accounts.</li>
            <li>“Transfers” between your accounts are only notes inside the app.</li>
          </ul>
        </>
      ),
    },
    {
      id: "requisitos",
      title: "Who can use it",
      body: (
        <p>
          You must be at least {LEGAL.minimumAge} years old and legally able to accept these Terms.
          The account is personal: use it only for your own finances.
        </p>
      ),
    },
    {
      id: "cuenta",
      title: "Your account",
      body: (
        <ul>
          <li>Give a real name and email and keep them up to date.</li>
          <li>
            Keep your password secret. You are responsible for what is done with your account if you
            share your password.
          </li>
          <li>
            Let us know if you think someone got into your account without permission, and change
            your password.
          </li>
        </ul>
      ),
    },
    {
      id: "uso",
      title: "Acceptable use",
      body: (
        <>
          <p>When using {LEGAL.service} you agree not to:</p>
          <ul>
            <li>Type account numbers, card numbers, banking passwords or identity documents.</li>
            <li>Try to access other people’s data or accounts.</li>
            <li>
              Attack, overload or try to get around the service’s security measures, or automate its
              use abusively.
            </li>
            <li>
              Use Balbo for purposes unrelated to your personal finances or try to manipulate it
              into doing something else.
            </li>
            <li>Use the service for unlawful activities.</li>
          </ul>
        </>
      ),
    },
    {
      id: "asesoria",
      title: "No financial advice",
      body: (
        <>
          <p>
            Projected balances, forecasts, limit warnings and Balbo’s answers are{" "}
            <strong>guidance estimates</strong> based on what you record. They are not financial,
            tax, legal or investment advice, and they may contain errors.
          </p>
          <p>
            Decisions about your money are yours. For important decisions, consult a professional.
          </p>
        </>
      ),
    },
    {
      id: "balbo",
      title: "Balbo, the AI assistant",
      body: (
        <p>
          Balbo is optional and runs on Google’s Gemini. To use it you must turn it on and agree to
          a summary of your finances being sent to Google, as explained in the{" "}
          <Link href="/legal/privacidad#balbo">Privacy policy</Link>. There is a maximum number of
          questions per hour, and it may be unavailable at times.
        </p>
      ),
    },
    {
      id: "precio",
      title: "Price and availability",
      body: (
        <p>
          {LEGAL.service} is free. We do our best to keep it always working, but there may be
          interruptions for maintenance or failures. We may change, improve or remove features; if
          we ever stop providing the service, we will give reasonable notice so you can download
          your data.
        </p>
      ),
    },
    {
      id: "propiedad",
      title: "Intellectual property",
      body: (
        <p>
          The design, code, brand and content of {LEGAL.service}, including the Balbo character,
          belong to {LEGAL.owner}. The data you record is yours: you can download or delete it
          whenever you want.
        </p>
      ),
    },
    {
      id: "responsabilidad",
      title: "Liability",
      body: (
        <p>
          To the extent permitted by law, {LEGAL.owner} is not liable for decisions you make based
          on the app’s estimates, for errors in the data you enter or for service interruptions
          beyond their control. Nothing in these Terms limits the rights granted to you by consumer
          protection or data protection laws.
        </p>
      ),
    },
    {
      id: "baja",
      title: "Closing and suspension",
      body: (
        <>
          <p>
            You can delete your account whenever you want from Settings › Privacy and data.
            Everything will be erased immediately and permanently.
          </p>
          <p>
            We may suspend or close an account that seriously breaches these Terms or puts the
            security of the service or of other people at risk.
          </p>
        </>
      ),
    },
    {
      id: "cambios",
      title: "Changes to the Terms",
      body: (
        <p>
          If we change these Terms, we will update the date and version above. If the change is
          significant, we will ask you to accept it before you keep using the app. If you don’t
          agree, you can delete your account.
        </p>
      ),
    },
    {
      id: "ley",
      title: "Governing law",
      body: (
        <p>
          These Terms are governed by the laws of the {LEGAL_EN.country}. Any dispute will first be
          settled amicably if possible and, if not, before the competent courts of Panama.
        </p>
      ),
    },
  ] satisfies LegalSection[],
};
