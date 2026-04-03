import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PricingPlan {
  name: string;
  price: string;
  billingNote?: string;
  description: string;
  ctaLabel: string;
  badge?: string;
  valueStatement?: string;
  features: string[];
  emphasized?: boolean;
  action: "free" | "team";
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Free Sandbox",
    price: "Free",
    description: "Intended for evaluation only.",
    ctaLabel: "Start Free",
    action: "free",
    features: [
      "1 seat",
      "1 project",
      "Preview and manual deploys only",
      "Short log retention",
      "No custom domains",
      "No alerts or notifications",
      "No Notion sync",
      "Limited AI allowance",
    ],
  },
  {
    name: "Team",
    price: "$79/month",
    billingNote: "$790/year · 2 months free",
    description: "Built for small engineering teams that want production visibility and cleaner deploy recovery.",
    ctaLabel: "Start Team Plan",
    action: "team",
    badge: "Most teams start with Team",
    valueStatement: "Vercel-speed deploys with clearer control, logs, workers, and recovery.",
    emphasized: true,
    features: [
      "Up to 5 seats",
      "Up to 10 projects",
      "Production + preview deployments",
      "Custom domains",
      "GitHub integration",
      "Build rules and deploy webhooks",
      "Deployment logs and metrics",
      "Slack / Discord / webhook notifications",
      "Notion deployment trigger + sync",
      "AI failure summaries and copilot access",
      "Standard email support",
    ],
  },
];

export const WHY_TEAMS_CHOOSE = [
  "Transparent deployment pipeline",
  "Better operational visibility than black-box hosting",
  "Alerts, domains, integrations, and deployment history",
  "AI-assisted failure diagnosis",
];

export const GOOD_FIT_TEAMS = [
  "small startup teams",
  "founder-led engineering teams",
  "agencies and dev shops managing multiple repos",
];

interface PricingCardsProps {
  onFreeAction: () => void;
  onTeamAction: () => void;
}

export function PricingCards({ onFreeAction, onTeamAction }: PricingCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
      {PRICING_PLANS.map((plan) => (
        <PricingCard
          key={plan.name}
          plan={plan}
          onAction={plan.action === "team" ? onTeamAction : onFreeAction}
        />
      ))}
    </div>
  );
}

interface PricingSectionProps {
  onFreeAction: () => void;
  onTeamAction: () => void;
  className?: string;
}

export function PricingSection({ onFreeAction, onTeamAction, className }: PricingSectionProps) {
  return (
    <section id="pricing" className={cn("border-t border-zinc-800 px-6 py-24", className)}>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-semibold text-white md:text-4xl">
            Simple pricing for teams that want visibility, not black-box deploys
          </h2>
          <p className="text-lg text-zinc-400">
            Aetheria gives you fast GitHub-native deployments with clearer logs, better recovery, and team-ready controls.
          </p>
        </div>
        <PricingCards onFreeAction={onFreeAction} onTeamAction={onTeamAction} />
        <p className="mt-6 text-center text-sm text-zinc-500">
          Pricing is shaped around projects + seats, not build-minute metering.
        </p>
      </div>
    </section>
  );
}

interface PricingCardProps {
  plan: PricingPlan;
  onAction: () => void;
}

export function PricingCard({ plan, onAction }: PricingCardProps) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col p-0 hover:bg-zinc-900",
        plan.emphasized && "border-violet-500/30 bg-zinc-900 ring-1 ring-violet-500/20"
      )}
    >
      <CardHeader className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">{plan.name}</div>
            <CardTitle className="text-3xl">{plan.price}</CardTitle>
            {plan.billingNote ? <div className="text-sm text-violet-400">{plan.billingNote}</div> : null}
          </div>
          {plan.badge ? (
            <div className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
              {plan.badge}
            </div>
          ) : null}
        </div>
        <CardDescription className="text-base leading-7">{plan.description}</CardDescription>
        {plan.valueStatement ? (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm text-violet-300">
            {plan.valueStatement}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 px-6 pb-6 pt-0">
        <div className="space-y-3">
          {plan.features.map((feature) => (
            <div key={feature} className="flex items-start gap-3 text-sm text-zinc-300">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-violet-400">
                <Check className="h-3.5 w-3.5" />
              </div>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="p-6 pt-0">
        <Button
          onClick={onAction}
          variant={plan.emphasized ? "default" : "outline"}
          className="w-full justify-center"
        >
          {plan.ctaLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export function WhyChooseAetheria() {
  return (
    <section className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-white">Why teams choose Aetheria</h2>
        <p className="mt-2 text-zinc-400">
          The platform is designed to make deploy execution visible, predictable, and easier to recover when things go wrong.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {WHY_TEAMS_CHOOSE.map((item) => (
          <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Check className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm text-zinc-300">{item}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GoodFitCallout() {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-white">Aetheria is best for</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {GOOD_FIT_TEAMS.map((team) => (
          <div key={team} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-sm text-zinc-300">{team}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
