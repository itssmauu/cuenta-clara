import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata: Metadata = { title: "Configura tu cuenta" };

export default function OnboardingPage() {
  return (
    <main className="bg-canvas min-h-dvh px-4 py-6 sm:px-10">
      <div className="mx-auto max-w-[720px]">
        <OnboardingWizard />
      </div>
    </main>
  );
}
