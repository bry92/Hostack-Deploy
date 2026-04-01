import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/auth-web";
import { useLocation } from "wouter";
import { Check, ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for personal projects and side hustles.",
    features: [
      "Unlimited projects",
      "Unlimited deployments",
      "Preview environments",
      "Custom domains + SSL",
      "GitHub integration",
      "Basic metrics & logs",
      "Community support",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$20",
    period: "per month",
    description: "For professional developers and small teams.",
    features: [
      "Everything in Free, plus:",
      "Advanced metrics & alerts",
      "Runtime log retention (30 days)",
      "AI copilot deployment analysis",
      "Priority support",
      "Slack & Discord integrations",
      "Sentry & Datadog integrations",
      "SSH key support",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$99",
    period: "per month",
    description: "For growing teams shipping at scale.",
    features: [
      "Everything in Pro, plus:",
      "Team collaboration features",
      "Advanced notification settings",
      "Custom integrations",
      "Runtime log retention (90 days)",
      "Dedicated support channel",
      "SLA guarantees",
      "Priority feature requests",
    ],
    cta: "Start Team Trial",
    highlighted: false,
  },
];

const FAQ = [
  {
    question: "Is the Free plan really free forever?",
    answer: "Yes. The Free plan is designed for personal projects, open source work, and side projects. You can deploy unlimited projects with no time limit and no credit card required.",
  },
  {
    question: "What counts as a deployment?",
    answer: "A deployment is triggered every time you push to a connected branch or manually trigger a build. Preview deployments (from pull requests) and production deployments both count, but we don't charge per deployment—all plans include unlimited deployments.",
  },
  {
    question: "Can I upgrade or downgrade at any time?",
    answer: "Absolutely. You can upgrade to Pro or Team at any time, and downgrade back to Free whenever you'd like. Billing is prorated, so you only pay for what you use.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards (Visa, Mastercard, American Express) via Stripe. Enterprise customers can arrange invoicing.",
  },
  {
    question: "Do you offer discounts for open source projects?",
    answer: "Yes! Open source projects with a public repository and an OSI-approved license can apply for a free Pro plan. Contact us with your project details.",
  },
  {
    question: "What happens if I exceed my plan limits?",
    answer: "The Free plan has no hard limits on deployments or projects. If your usage grows significantly, we may reach out to discuss upgrading to a paid plan, but we'll never shut down your deployments without notice.",
  },
  {
    question: "Is there an enterprise plan?",
    answer: "Not yet, but we're building one. If you need custom SLAs, dedicated infrastructure, or on-premise deployment options, reach out and we'll work with you.",
  },
];

export default function Pricing() {
  const { isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();

  const handleCTA = (plan: string) => {
    if (isAuthenticated) {
      setLocation("/dashboard");
      return;
    }
    login("/dashboard");
  };

  return (
    <PublicPageShell
      eyebrow="Pricing"
      title="Simple, transparent pricing."
      description="Start free, upgrade when you're ready. No hidden fees, no surprises."
    >
      <section className="mb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlighted ? "border-violet-500/50 bg-gradient-to-b from-violet-500/5 to-zinc-900" : ""}
            >
              <CardHeader>
                <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="ml-2 text-zinc-400">/ {plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3 text-sm text-zinc-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleCTA(plan.name)}
                  variant={plan.highlighted ? "default" : "outline"}
                  className="w-full"
                  size="lg"
                >
                  {plan.cta} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold text-white">Frequently Asked Questions</h2>
        <Card>
          <CardContent className="pt-6">
            <Accordion type="single" collapsible className="w-full">
              {FAQ.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-white">{item.question}</AccordionTrigger>
                  <AccordionContent className="text-zinc-400">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-zinc-900">
          <CardContent className="py-12 text-center">
            <h2 className="mb-4 text-3xl font-semibold text-white">Still have questions?</h2>
            <p className="mb-8 text-lg text-zinc-400">
              We're here to help. Reach out and we'll get back to you within 24 hours.
            </p>
            <Button size="lg" variant="outline" asChild>
              <a href="mailto:support@hostack.dev">Contact Support</a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </PublicPageShell>
  );
}
