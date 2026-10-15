import { LEGAL } from "@/lib/legal";

/** The legal references of `LEGAL`, in English, for the translated documents. */
export const LEGAL_EN = {
  ownerKind: "a natural person",
  country: "Republic of Panama",
  authority: "National Authority for Transparency and Access to Information (ANTAI)",
  law: "Law 81 of March 26, 2019 on Personal Data Protection",
  regulation: "Executive Decree 285 of May 28, 2021",
};

/** Shown at the top of every translated document. */
export function TranslationNotice() {
  return (
    <>
      This is a translation provided for convenience. The Spanish version of this document is the
      binding one; if they differ, the Spanish version prevails. {LEGAL.service} is operated from
      Panama under Panamanian law.
    </>
  );
}
