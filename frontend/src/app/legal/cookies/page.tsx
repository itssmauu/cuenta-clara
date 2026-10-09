import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { COOKIE_NOTICE_KEY } from "@/components/legal/CookieNotice";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Qué cookies usa Cuenta Clara y para qué.",
};

const summary = [
  "Solo usamos cookies técnicas, imprescindibles para iniciar sesión y protegerte.",
  "No usamos cookies de analítica, publicidad ni seguimiento, ni de terceros.",
  "Por eso no te pedimos que elijas cookies: sin estas, no podrías entrar a tu cuenta.",
];

const cookies = [
  {
    name: "access_token",
    purpose: "Mantiene tu sesión iniciada. Es inaccesible para scripts (HttpOnly).",
    duration: "15 minutos",
  },
  {
    name: "refresh_token",
    purpose:
      "Renueva tu sesión sin pedirte la contraseña otra vez. HttpOnly y limitada a la ruta de autenticación.",
    duration: "7 días o hasta que cierres sesión",
  },
  {
    name: "csrf_token",
    purpose: "Protege tus formularios frente a peticiones falsificadas desde otras webs (CSRF).",
    duration: "7 días o hasta que cierres sesión",
  },
];

const sections: LegalSection[] = [
  {
    id: "que-son",
    title: "Qué son las cookies",
    body: (
      <p>
        Las cookies son pequeños archivos que una web guarda en tu navegador. Sirven, por ejemplo,
        para recordar que ya iniciaste sesión.
      </p>
    ),
  },
  {
    id: "cuales",
    title: "Qué cookies usamos",
    body: (
      <>
        <p>
          Todas son propias, de sesión segura (solo viajan por HTTPS y nunca a otras webs) y
          estrictamente necesarias:
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th scope="col">COOKIE</th>
                <th scope="col">PARA QUÉ SIRVE</th>
                <th scope="col">DURACIÓN</th>
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
        </div>
      </>
    ),
  },
  {
    id: "almacenamiento",
    title: "Almacenamiento local del navegador",
    body: (
      <p>
        Además, guardamos en el almacenamiento local de tu navegador (
        <code>{COOKIE_NOTICE_KEY}</code>) que ya cerraste el aviso de cookies, para no mostrártelo
        cada vez. No contiene datos personales. La conversación con Balbo no se guarda en ningún
        sitio: se borra al recargar.
      </p>
    ),
  },
  {
    id: "terceros",
    title: "Cookies de terceros",
    body: (
      <p>
        No usamos ninguna: ni Google Analytics, ni píxeles de redes sociales, ni publicidad. Las
        fuentes tipográficas se sirven desde nuestro propio servidor, sin llamar a terceros.
      </p>
    ),
  },
  {
    id: "control",
    title: "Cómo controlarlas",
    body: (
      <p>
        Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Si bloqueas las
        de {LEGAL.service}, no podrás iniciar sesión. Al cerrar sesión, las tres se eliminan.
      </p>
    ),
  },
  {
    id: "cambios",
    title: "Cambios",
    body: (
      <p>
        Si algún día añadimos cookies que no sean imprescindibles, te pediremos permiso antes de
        usarlas y actualizaremos esta página. Más detalles sobre tus datos en la{" "}
        <Link href="/legal/privacidad">Política de privacidad</Link>.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Política de cookies"
      current="/legal/cookies"
      summary={summary}
      sections={sections}
    />
  );
}
