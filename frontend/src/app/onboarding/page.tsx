import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Configura tu cuenta") };
}

export default function OnboardingPage() {
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="bg-canvas min-h-dvh px-4 py-6 outline-none sm:px-10"
    >
      <div className="mx-auto max-w-[720px]">
        <OnboardingWizard />
      </div>
    </main>
  );
}
