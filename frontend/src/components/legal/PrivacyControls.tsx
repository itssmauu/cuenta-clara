"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/Dialog";
import { FormAlert } from "@/components/ui/FormAlert";
import { PasswordField } from "@/components/ui/PasswordField";
import { useT } from "@/i18n/client";
import { msg } from "@/i18n/translate";
import { ApiError } from "@/lib/api";
import { privacyApi, saveAsJsonFile } from "@/lib/privacy-api";

/** Right of access and portability: a full copy of the user's data, as a JSON file. */
export function ExportDataButton({ onError }: { onError: (message: string) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      saveAsJsonFile(await privacyApi.exportData());
    } catch {
      onError(t("No pudimos preparar la descarga. Inténtalo de nuevo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={busy}
      aria-busy={busy}
      className={buttonClass("ink")}
    >
      <Download aria-hidden="true" className="size-4" />
      {busy ? t("Preparando…") : t("Descargar mis datos")}
    </button>
  );
}

/** Right of cancellation: deletes the account and everything in it, after the password. */
export function DeleteAccountButton() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setPassword("");
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError(msg("Escribe tu contraseña para confirmar."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await privacyApi.deleteAccount(password);
      router.replace("/");
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : t("No pudimos eliminar tu cuenta."));
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("danger")}>
        <Trash2 aria-hidden="true" className="size-4" />
        {t("Eliminar mi cuenta")}
      </button>
      <Dialog
        open={open}
        onClose={close}
        title={t("Eliminar tu cuenta")}
        description={t("Esto no se puede deshacer.")}
      >
        <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-5">
          <p className="text-body leading-relaxed">
            {t(
              "Se borrarán para siempre tu cuenta, tus cuentas y saldos, tus movimientos, tus metas y tu configuración. Si quieres conservar una copia, descarga tus datos antes.",
            )}
          </p>
          {error ? <FormAlert title={error} /> : null}
          <PasswordField
            id="delete-password"
            label={t("Tu contraseña, para confirmar")}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={close} className={buttonClass("ghost")}>
              {t("Cancelar")}
            </button>
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className={buttonClass("danger")}
            >
              {busy ? t("Eliminando…") : t("Eliminar para siempre")}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
