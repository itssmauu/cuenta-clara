import type { Metadata } from "next";

import { SessionGreeting } from "@/components/auth/SessionGreeting";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="bg-canvas-dashboard min-h-dvh px-4 py-5 sm:px-10">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-6">
        <Logo />
        <main className="bg-surface rounded-panel p-8 sm:p-12">
          <SessionGreeting />
        </main>
      </div>
    </div>
  );
}
