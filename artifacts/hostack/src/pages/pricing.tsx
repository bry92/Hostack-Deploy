import { useLocation } from "wouter";

import { useAuth } from "@workspace/auth-web";

import { GoodFitCallout, PricingCards, WhyChooseAetheria } from "@/components/marketing/pricing";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Pricing() {
  const { isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();

  const handleFreeAction = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
      return;
    }

    login("/dashboard");
  };

  const handleTeamCheckout = async () => {
    if (!isAuthenticated) {
      login("/dashboard");
      return;
    }

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ interval: "month" }),
      });

      if (!response.ok) {
        throw new Error("Stripe checkout failed");
      }

      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to start Team checkout", error);
    }
  };

  return (
    <PublicPageShell
      eyebrow="Pricing"
      title="Simple pricing for teams that want visibility, not black-box deploys"
      description="Aetheria gives you fast GitHub-native deployments with clearer logs, better recovery, and team-ready controls."
    >
      <div className="space-y-6">
        <PricingCards onFreeAction={handleFreeAction} onTeamAction={handleTeamCheckout} />
        <p className="text-center text-sm text-zinc-500">
          Pricing is shaped around projects + seats, not build-minute metering.
        </p>
        <WhyChooseAetheria />
        <GoodFitCallout />
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-white">Deploy with visibility from day one</h2>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
            Both plans stay self-serve today, so your team can start with the sandbox or move straight into the Team plan without a sales cycle.
          </p>
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={handleTeamCheckout}>
              Deploy with Visibility <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
