"use client";

import { MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from "react";

import { useSession } from "@/components/app/session";
import { ApiError } from "@/lib/api";
import {
  assistantApi,
  MAX_MESSAGE_LENGTH,
  type AssistantStatus,
  type ChatMessage,
} from "@/lib/assistant-api";
import { privacyApi } from "@/lib/privacy-api";

import { BalboBot, type BalboState } from "./BalboBot";

const SUGGESTIONS = [
  "¿Me alcanza para comprar una PS5?",
  "Dame un plan para ahorrar este mes",
  "¿Cómo voy esta semana?",
  "¿En qué estoy gastando más?",
];

// Static classes (Tailwind only sees literal class names): a wave across the three dots
const DOT_DELAYS = ["[animation-delay:0ms]", "[animation-delay:150ms]", "[animation-delay:300ms]"];

type Shown = ChatMessage & { id: number; offTopic?: boolean; error?: boolean };

/**
 * Balbo, the finance copilot: a round button at the bottom right of every signed-in
 * page that opens a chat panel. The panel grows out of the button (origin-aware),
 * replies arrive with a short rise, and nothing is stored outside this browser tab.
 */
export function Balbo() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [activating, setActivating] = useState(false);
  const [messages, setMessages] = useState<Shown[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const nextId = useRef(0);
  const panelId = useId();
  const titleId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const activateRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const available = status ? status.available : null;
  const consented = status?.consented ?? false;
  const offline = available === false;
  const needsConsent = available === true && !consented;

  // Ask on every open: the user may have turned Balbo on or off in Configuración meanwhile
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    assistantApi
      .status()
      .then((current) => !cancelled && setStatus(current))
      .catch(() => !cancelled && setStatus({ name: "Balbo", available: false, consented: false }));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Land inside the panel: on the question box, on "Activar" or on "close" while unavailable
  useEffect(() => {
    if (!open || status === null) return;
    (offline ? closeRef.current : needsConsent ? activateRef.current : inputRef.current)?.focus();
  }, [open, status, offline, needsConsent]);

  // Escape closes the panel wherever the focus is (it is not a modal)
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      launcherRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Keep the newest message in view; an empty chat starts at the top, where Balbo waves
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = messages.length === 0 && !sending ? 0 : log.scrollHeight;
  }, [messages, sending, open]);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function activate() {
    setActivating(true);
    try {
      await privacyApi.grantAssistant();
      setStatus((current) => current && { ...current, consented: true });
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          error: true,
          content: "No pude activarme ahora mismo. Inténtalo de nuevo.",
        },
      ]);
    } finally {
      setActivating(false);
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending || !consented) return;
    const asked: Shown = { id: nextId.current++, role: "user", content: question };
    // Errors are shown to the user but never sent back to the model as history
    const history = [...messages.filter((m) => !m.error), asked].map(({ role, content }) => ({
      role,
      content,
    }));
    setMessages((current) => [...current, asked]);
    setDraft("");
    setSending(true);
    try {
      const { reply, on_topic } = await assistantApi.chat(history);
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", content: reply, offTopic: !on_topic },
      ]);
    } catch (error) {
      // Turned off from another tab: show the consent screen again
      if (error instanceof ApiError && error.status === 403) {
        setStatus((current) => current && { ...current, consented: false });
      }
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          error: true,
          content:
            error instanceof ApiError
              ? error.message
              : "No pude responder ahora mismo. Inténtalo de nuevo.",
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a line
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  const firstName = user.name.split(" ")[0];
  // What the robot does: waves on an empty chat, types while replying, listens otherwise
  const botState: BalboState = sending
    ? "typing"
    : messages.length === 0
      ? "greeting"
      : "attentive";
  const locked = offline || !consented;

  return (
    <>
      <section
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        data-open={open || undefined}
        className="balbo-panel fixed right-4 bottom-24 z-40 flex h-[min(580px,calc(100dvh-8rem))] w-[min(390px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_64px_-16px_rgb(21_25_61/0.45)] sm:right-6"
      >
        <header className="bg-ink flex items-center gap-3 px-5 py-4 text-white">
          <BalboBot size={44} state={botState} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 id={titleId} className="font-display text-lg leading-tight font-bold">
              Balbo
            </h2>
            <span className="text-on-ink flex items-center gap-1.5 text-xs font-semibold">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${offline ? "bg-on-ink-muted" : "bg-mint"}`}
              />
              {offline ? "No disponible ahora" : "Tu copiloto financiero"}
            </span>
          </div>
          <button
            type="button"
            ref={closeRef}
            onClick={close}
            aria-label="Cerrar el chat con Balbo"
            className="hover:bg-ink-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-[background-color,scale] duration-200 active:scale-[0.94]"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Conversación con Balbo"
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex justify-center pt-1 pb-1">
              <BalboBot
                size={108}
                state="greeting"
                label="Balbo, el robot de Cuenta Clara, saludando"
              />
            </div>
          ) : null}
          <Bubble role="assistant">
            {`¡Hola, ${firstName}! Soy Balbo 👋\nConozco tus cuentas, tus gastos fijos, tu predicción y tus metas. Pregúntame si te conviene una compra o cómo ahorrar para algo.`}
          </Bubble>
          {offline ? (
            <Bubble role="assistant" tone="error">
              Balbo no está disponible en este momento. El resto de Cuenta Clara funciona normal.
            </Bubble>
          ) : null}

          {needsConsent ? (
            <ConsentCard ref={activateRef} busy={activating} onActivate={() => void activate()} />
          ) : null}

          {messages.length === 0 && consented && !offline ? (
            <ul aria-label="Preguntas sugeridas" className="flex flex-wrap gap-2 pt-1">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="border-primary-soft text-primary hover:bg-primary-tint min-h-9 cursor-pointer rounded-full border-2 px-3 text-left text-[13px] font-bold transition-[background-color,scale] duration-200 active:scale-[0.97]"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {messages.map((message) => (
            <Bubble
              key={message.id}
              role={message.role}
              tone={message.error ? "error" : message.offTopic ? "info" : undefined}
            >
              {message.content}
            </Bubble>
          ))}

          {sending ? (
            <div role="status" className="animate-rise-in flex items-end gap-1 self-start">
              <span className="sr-only">Balbo está escribiendo…</span>
              {/* Balbo pulls out its phone and types */}
              <BalboBot size={46} state="typing" />
              <div className="bg-canvas mb-2 flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3">
                {DOT_DELAYS.map((delay) => (
                  <span
                    key={delay}
                    aria-hidden="true"
                    className={`balbo-dot bg-muted size-2 rounded-full ${delay}`}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={onSubmit}
          className="border-line flex flex-col gap-2 border-t px-4 pt-3 pb-3"
        >
          <div className="flex items-end gap-2">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Escribe tu pregunta para Balbo
            </label>
            <textarea
              id={`${panelId}-input`}
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={locked}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                offline
                  ? "No disponible ahora"
                  : !consented
                    ? "Activa a Balbo para preguntar"
                    : "Pregúntale a Balbo…"
              }
              className="rounded-field border-field hover:border-primary-soft focus:border-primary text-ink placeholder:text-muted/80 max-h-32 min-h-11 flex-1 resize-none border-2 bg-white px-3.5 py-2.5 text-[15px] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={locked || sending || !draft.trim()}
              aria-label="Enviar pregunta"
              className="bg-primary hover:bg-primary-hover grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-white transition-[background-color,scale,opacity] duration-200 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send aria-hidden="true" className="size-5" />
            </button>
          </div>
          <p className="text-muted text-[11px] leading-snug">
            Balbo usa IA (Gemini de Google) con un resumen de tus finanzas. Es orientación, no
            asesoría financiera profesional. Puedes desactivarlo en Configuración.
          </p>
        </form>
      </section>

      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          open ? "Cerrar el chat con Balbo" : "Abrir el chat con Balbo, tu copiloto financiero"
        }
        className="bg-primary hover:bg-primary-hover ease-out-strong fixed right-4 bottom-5 z-40 grid size-14 cursor-pointer place-items-center rounded-full text-white shadow-[0_14px_30px_-10px_rgb(91_75_219/0.7)] transition-[background-color,scale] duration-200 hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6"
      >
        {/* Keyed by state: the icon swaps with a short blur instead of snapping */}
        <span key={open ? "close" : "open"} className="animate-value-in grid place-items-center">
          {open ? (
            <X aria-hidden="true" className="size-6" />
          ) : (
            <MessageCircle aria-hidden="true" className="size-6" />
          )}
        </span>
      </button>
    </>
  );
}

/** What turning Balbo on means, in plain words, before anything leaves Cuenta Clara. */
function ConsentCard({
  ref,
  busy,
  onActivate,
}: {
  ref: Ref<HTMLButtonElement>;
  busy: boolean;
  onActivate: () => void;
}) {
  return (
    <div className="bg-primary-tint text-on-tint animate-rise-in flex flex-col gap-3 rounded-2xl p-4 text-[13px] leading-relaxed">
      <p className="text-ink flex items-center gap-2 text-sm font-bold">
        <ShieldCheck aria-hidden="true" className="text-primary size-5" />
        Antes de empezar
      </p>
      <p>
        Para responderte, Balbo envía a <strong className="text-ink">Gemini, de Google</strong>, tu
        pregunta y un resumen de tus finanzas: tu primer nombre, tus cuentas y saldos, tus ingresos,
        gastos y metas. Nunca tu correo ni tu contraseña.
      </p>
      <p>
        Google puede procesarlo fuera de Panamá. Puedes desactivar a Balbo cuando quieras en
        Configuración.{" "}
        <Link href="/legal/privacidad#balbo" className="text-primary font-bold hover:underline">
          Más detalles
        </Link>
      </p>
      <button
        ref={ref}
        type="button"
        onClick={onActivate}
        disabled={busy}
        className="bg-primary hover:bg-primary-hover min-h-11 cursor-pointer self-start rounded-full px-5 text-sm font-bold text-white transition-[background-color,scale,opacity] duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Activando…" : "Acepto, activar Balbo"}
      </button>
    </div>
  );
}

function Bubble({
  role,
  tone,
  children,
}: {
  role: ChatMessage["role"];
  tone?: "error" | "info";
  children: string;
}) {
  const mine = role === "user";
  const surface = mine
    ? "bg-primary self-end rounded-br-md text-white"
    : tone === "error"
      ? "bg-danger-tint text-danger self-start rounded-bl-md"
      : tone === "info"
        ? "bg-accent-tint text-ink self-start rounded-bl-md"
        : "bg-canvas text-ink self-start rounded-bl-md";
  return (
    <div
      className={`animate-rise-in max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${surface}`}
    >
      <span className="sr-only">{mine ? "Tú: " : "Balbo: "}</span>
      <RichText text={children} />
    </div>
  );
}

/** Plain text with paragraphs and "- " bullets. Never parsed as HTML. */
function RichText({ text }: { text: string }) {
  const blocks: { bullets: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•*]\s+/.test(line);
    const content = line.replace(/^[-•*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1");
    const last = blocks.at(-1);
    if (last && last.bullets === bullet && bullet) last.lines.push(content);
    else blocks.push({ bullets: bullet, lines: [content] });
  }
  return (
    <span className="flex flex-col gap-1.5">
      {blocks.map((block, index) =>
        block.bullets ? (
          <ul key={index} className="flex list-disc flex-col gap-1 pl-4">
            {block.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          block.lines.map((line, i) => <span key={`${index}-${i}`}>{line}</span>)
        ),
      )}
    </span>
  );
}
