import { FinalCta, SiteFooter, Testimonial } from "@/components/landing/Closing";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { InsightsAndSecurity } from "@/components/landing/InsightsAndSecurity";
import { Prediction } from "@/components/landing/Prediction";
import { SiteHeader } from "@/components/landing/SiteHeader";

export default function LandingPage() {
  return (
    <div
      id="top"
      className="mx-auto flex w-full max-w-[1360px] flex-col gap-16 px-4 pt-5 sm:gap-24 sm:px-10"
    >
      <SiteHeader />
      <main className="flex flex-col gap-16 sm:gap-24">
        <Hero />
        <HowItWorks />
        <Prediction />
        <InsightsAndSecurity />
        <Testimonial />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
