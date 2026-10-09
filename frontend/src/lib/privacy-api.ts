/** The user's rights over their data: consent, a copy of everything, and deletion. */
import { request, type User } from "./api";

export const privacyApi = {
  acceptTerms: (termsVersion: string) =>
    request<User>("/me/consent", { method: "POST", body: { terms_version: termsVersion } }),
  /** Everything stored about the user, as a JSON document */
  exportData: () => request<Record<string, unknown>>("/me/export"),
  deleteAccount: (password: string) =>
    request<void>("/me/delete", { method: "POST", body: { password } }),
  grantAssistant: () => request<void>("/assistant/consent", { method: "POST" }),
  revokeAssistant: () => request<void>("/assistant/consent", { method: "DELETE" }),
};

/** Saves the export as a file, named like the one the API would send. */
export function saveAsJsonFile(data: unknown, today = new Date()) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cuenta-clara-mis-datos-${today.toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the memory
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
