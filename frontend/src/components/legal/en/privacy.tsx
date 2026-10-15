import Link from "next/link";

import { PrivacyContact, type LegalSection } from "@/components/legal/LegalDocument";
import { LEGAL } from "@/lib/legal";

import { LEGAL_EN } from "./legal-en";

/** English translation of /legal/privacidad. The Spanish version prevails. */
export const privacyEn = {
  title: "Privacy policy",
  description:
    "What data Cuenta Clara processes, why, who it is shared with and how to exercise your rights.",
  summary: [
    `The controller of your data is ${LEGAL.owner} (${LEGAL_EN.ownerKind}), in the ${LEGAL_EN.country}.`,
    "We only ask for what is necessary: name, email, password and the figures you choose to record. Never account or card numbers.",
    "Your data is used to provide the service. We don’t sell it, we don’t advertise and we don’t use tracking cookies.",
    "Balbo, the AI assistant, is optional: it only sends a summary of your finances to Google if you turn it on.",
    "You can download all your data or delete your account yourself, whenever you want, from Settings.",
  ],
  sections: [
    {
      id: "responsable",
      title: "Who is responsible",
      body: (
        <>
          <p>
            The controller of your personal data in {LEGAL.service} is{" "}
            <strong>{LEGAL.owner}</strong>, {LEGAL_EN.ownerKind}, domiciled in the{" "}
            {LEGAL_EN.country}. They decide why and how your data is processed and are accountable
            for it.
          </p>
          <PrivacyContact />
        </>
      ),
    },
    {
      id: "normativa",
      title: "Applicable law",
      body: (
        <>
          <p>We process your data in accordance with:</p>
          <ul>
            <li>{LEGAL_EN.law}.</li>
            <li>{LEGAL_EN.regulation}, which regulates it.</li>
          </ul>
          <p>
            The supervisory authority is the {LEGAL_EN.authority}, with which you can file a
            complaint if you believe we have not respected your rights.
          </p>
        </>
      ),
    },
    {
      id: "datos",
      title: "What data we process",
      body: (
        <>
          <h3>Data you give us</h3>
          <ul>
            <li>
              <strong>Identification and access:</strong> your name, your email address and your
              password. The password is never stored as is: we only keep an Argon2 hash, from which
              it cannot be recovered.
            </li>
            <li>
              <strong>Financial data you record:</strong> the name and type of your accounts (for
              example “Spending” or “Savings”), balances, income, fixed and variable expenses,
              categories, transfers between your accounts, savings goals, your spending limit and
              your pay period.
            </li>
            <li>
              <strong>Messages to Balbo:</strong> the questions you write to the assistant, only if
              you turn it on. We don’t store the conversation history: it lives in your browser and
              is erased when you close or reload the page.
            </li>
          </ul>
          <h3>Data generated when you use the service</h3>
          <ul>
            <li>
              <strong>Sessions:</strong> for each sign-in we keep an encrypted identifier, its
              expiry date and the browser you used (its “user agent”), so you can stay signed in and
              unusual use can be detected.
            </li>
            <li>
              <strong>Security:</strong> the number of failed sign-in attempts and, where relevant,
              until when the account is locked. To limit abuse, your IP address is used in memory
              for a few minutes and is not stored in the database.
            </li>
            <li>
              <strong>Consents:</strong> which version of these documents you accepted and when, and
              whether and when you turned Balbo on.
            </li>
            <li>
              <strong>Password recovery:</strong> if you request it, a 6-digit code that we keep
              encrypted for at most 15 minutes, and the date of the last password change (to close
              earlier sessions).
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "no-pedimos",
      title: "What data we don’t ask for",
      body: (
        <>
          <p>
            {LEGAL.service} does not connect to your bank. We will never ask you for, and you should
            not type into the app:
          </p>
          <ul>
            <li>Bank account numbers, card numbers, CVV or PIN.</li>
            <li>Passwords or codes for your online banking.</li>
            <li>Your national ID card, passport or other identity documents.</li>
          </ul>
          <p>
            That is why the app rejects account names that look like an account number. If anyone
            asks you for this data on behalf of {LEGAL.service}, don’t give it to them.
          </p>
        </>
      ),
    },
    {
      id: "finalidades",
      title: "What we use it for",
      body: (
        <ul>
          <li>Creating and protecting your account, and letting you sign in.</li>
          <li>
            Calculating your dashboard: balance, spending in the period, limit, forecasts and
            progress on your goals.
          </li>
          <li>Generating the CSV or PDF reports you download.</li>
          <li>Answering your questions with Balbo, only if you turn it on.</li>
          <li>Detecting and preventing unauthorized access and abuse of the service.</li>
          <li>
            Sending you security emails: the code to recover your password and the notice that it
            changed. We don’t send advertising or newsletters.
          </li>
        </ul>
      ),
    },
    {
      id: "base-legal",
      title: "Legal basis",
      body: (
        <>
          <p>
            We process your data with your <strong>consent</strong>, which you give when creating
            the account by ticking the acceptance box. It is free, prior, informed and unequivocal:
            the box is never pre-ticked and we keep the version and date of what you accepted.
          </p>
          <p>
            Using Balbo requires a separate, additional consent. You can withdraw either one
            whenever you want: by turning Balbo off or deleting your account. Withdrawing it does
            not affect what was done earlier with your permission.
          </p>
        </>
      ),
    },
    {
      id: "balbo",
      title: "Balbo and artificial intelligence",
      body: (
        <>
          <p>
            Balbo is an optional assistant that answers questions about your finances. It runs on
            Gemini, an artificial intelligence model by Google LLC. Until you turn it on, nothing is
            sent.
          </p>
          <p>When you ask it a question, the following is sent to Google:</p>
          <ul>
            <li>Your question.</li>
            <li>
              A summary of your finances: your first name, your accounts by name and balance, your
              income and fixed expenses, spending in the period by category, your limit and your
              goals.
            </li>
          </ul>
          <p>
            Your email, password and last name are not sent. We ask Google not to store the
            conversation. Even so, under the Gemini API terms, when the free tier is used Google may
            use the content to improve its products and human reviewers may read it. So: don’t write
            in the chat anything you don’t want to share.
          </p>
          <p>
            Balbo can be wrong. Its answers are guidance, not professional financial advice, and
            decisions about your money are yours.
          </p>
        </>
      ),
    },
    {
      id: "destinatarios",
      title: "Who it is shared with",
      body: (
        <>
          <p>
            We don’t sell or rent your data, or hand it over for advertising. Only the following can
            access it:
          </p>
          <ul>
            <li>
              <strong>Providers that help us run the service</strong> (processors), such as server
              and database hosting, who may only use it for that.
            </li>
            <li>
              <strong>The email provider</strong> we use to send security emails (for example,
              Google Gmail). It only receives your email address, your name and the message.
            </li>
            <li>
              <strong>Google LLC</strong>, as the Gemini provider, only if you turn Balbo on and on
              the terms of the previous section.
            </li>
            <li>
              <strong>Authorities</strong>, when a law or a court order requires us to.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "transferencias",
      title: "International transfers",
      body: (
        <p>
          If you turn Balbo on, your question and the summary of your finances are processed on
          Google servers, which may be outside Panama (for example, in the United States). Hosting
          and email providers may also be outside the country. By turning Balbo on you give your
          express consent to that transfer, and we only work with providers that offer adequate
          security guarantees.
        </p>
      ),
    },
    {
      id: "conservacion",
      title: "How long we keep it",
      body: (
        <ul>
          <li>
            <strong>Your account and your financial data:</strong> for as long as you have the
            account. When you delete it, they are erased from the database immediately and
            permanently.
          </li>
          <li>
            <strong>Sessions:</strong> they expire after 7 days or when you sign out.
          </li>
          <li>
            <strong>Recovery codes:</strong> they expire after 15 minutes and are deleted when used
            or when you request a new one.
          </li>
          <li>
            <strong>Conversations with Balbo:</strong> we don’t keep them; they disappear when you
            close or reload the page.
          </li>
          <li>
            <strong>Backups and technical logs:</strong> if any, they are overwritten in short
            cycles and only used to restore the service after a failure.
          </li>
        </ul>
      ),
    },
    {
      id: "seguridad",
      title: "How we protect your data",
      body: (
        <ul>
          <li>
            Encrypted connection (HTTPS) and protected session cookies, unreachable by scripts.
          </li>
          <li>Passwords stored with Argon2, never in plain text.</li>
          <li>Temporary account lockout and attempt limits against brute-force attacks.</li>
          <li>Protection against request forgery (CSRF) and a content security policy.</li>
          <li>Each person can only see and change their own data.</li>
        </ul>
      ),
    },
    {
      id: "derechos",
      title: "Your rights",
      body: (
        <>
          <p>The law grants you the rights of:</p>
          <ul>
            <li>
              <strong>Access:</strong> knowing which of your data we process.
            </li>
            <li>
              <strong>Rectification:</strong> correcting data that is inaccurate or incomplete.
            </li>
            <li>
              <strong>Cancellation:</strong> asking for it to be deleted.
            </li>
            <li>
              <strong>Objection:</strong> objecting to a specific processing.
            </li>
            <li>
              <strong>Portability:</strong> receiving your data in a structured, commonly used
              format.
            </li>
          </ul>
          <p>You can exercise them yourself, instantly and free of charge, from the app:</p>
          <ul>
            <li>
              <strong>Access and portability:</strong> Settings › Privacy and data › “Download my
              data” (a JSON file with everything we store about you).
            </li>
            <li>
              <strong>Rectification:</strong> edit your accounts, transactions, goals or settings.
            </li>
            <li>
              <strong>Cancellation:</strong> Settings › Privacy and data › “Delete my account”.
            </li>
            <li>
              <strong>Objection to the use of AI:</strong> turn Balbo off at any time.
            </li>
          </ul>
          {LEGAL.contactEmail ? (
            <p>
              You can also write to us at{" "}
              <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. We will reply
              within 10 business days at most. To protect your account, we will ask you to confirm
              that you are the account holder.
            </p>
          ) : null}
          <p>
            If you disagree with our answer, you can file a complaint with the {LEGAL_EN.authority}.
          </p>
        </>
      ),
    },
    {
      id: "menores",
      title: "Minors",
      body: (
        <p>
          {LEGAL.service} is intended for people over {LEGAL.minimumAge}. We don’t knowingly create
          accounts for minors. If you know that a minor created an account, it can be deleted from
          the account itself or by letting us know.
        </p>
      ),
    },
    {
      id: "incidentes",
      title: "Security incidents",
      body: (
        <p>
          If a security breach affecting your data occurred, we would notify the{" "}
          {LEGAL_EN.authority} and the people affected within the deadlines set by the regulations,
          explaining what happened, which data was affected and what measures we took.
        </p>
      ),
    },
    {
      id: "cambios",
      title: "Changes to this policy",
      body: (
        <>
          <p>
            If we change this policy, we will update the date and version above. If the change is
            significant, we will ask you to accept it again the next time you sign in, before you
            keep using the app.
          </p>
          <p>
            See also the <Link href="/legal/terminos">Terms and conditions</Link> and the{" "}
            <Link href="/legal/cookies">Cookie policy</Link>.
          </p>
        </>
      ),
    },
  ] satisfies LegalSection[],
};
