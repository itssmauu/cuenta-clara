/**
 * Who is responsible for Cuenta Clara and which version of the legal documents is in force.
 *
 * - LEGAL.version must match TERMS_VERSION in backend/app/core/legal.py: when they change,
 *   every user is asked to accept the new documents.
 * - The privacy contact email is configured with NEXT_PUBLIC_PRIVACY_EMAIL. Until it is
 *   set, the documents point to the in-app tools (download or delete your data), which
 *   cover every right without needing an email.
 */
export const LEGAL = {
  service: "Cuenta Clara",
  owner: "Mauro González",
  ownerKind: "persona natural",
  country: "República de Panamá",
  version: "2026-10-09",
  updatedOn: "9 de octubre de 2026",
  minimumAge: 18,
  contactEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || null,
  authority: "Autoridad Nacional de Transparencia y Acceso a la Información (ANTAI)",
  law: "Ley 81 de 26 de marzo de 2019 sobre Protección de Datos Personales",
  regulation: "Decreto Ejecutivo 285 de 28 de mayo de 2021",
} as const;

export const LEGAL_PAGES = [
  { href: "/legal/privacidad", label: "Política de privacidad", short: "Privacidad" },
  { href: "/legal/terminos", label: "Términos y condiciones", short: "Términos" },
  { href: "/legal/cookies", label: "Política de cookies", short: "Cookies" },
] as const;
