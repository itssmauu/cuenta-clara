/** Calls to Balbo, the finance assistant. The conversation lives only in the browser. */
import { request } from "./api";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

/** The API accepts up to this many turns; older ones are dropped before sending */
export const MAX_HISTORY = 12;
export const MAX_MESSAGE_LENGTH = 1000;

export type AssistantStatus = { name: string; available: boolean; consented: boolean };

export const assistantApi = {
  /** `consented`: the user turned Balbo on (nothing is sent to the model before that) */
  status: () => request<AssistantStatus>("/assistant"),
  /** `messages` ends with the user's question; returns Balbo's reply */
  chat: (messages: ChatMessage[]) =>
    request<{ reply: string; on_topic: boolean }>("/assistant/chat", {
      method: "POST",
      body: { messages: messages.slice(-MAX_HISTORY) },
    }),
};
