import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata: Metadata = { title: "Configura tu cuenta" };

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
