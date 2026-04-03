import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/auth-web";
import { useLocation } from "wouter";
import { Check, X, ArrowRight } from "lucide-react";

const COMPARISON_ROWS = [
  { feature: "Automated GitHub deployments", hostack: true, vercel: true, netlify: true, render: true },
  { feature: "Preview environments per PR", hostack: true, vercel: true, netlify: true, render: true },
  { feature: "One-click rollbacks", hostack: true, vercel: true, netlify: true, render: true },
  { feature: "Custom domains + SSL", hostack: true, vercel: true, netlify: true, render: true },
  { feature: "Real-time build log streaming", hostack: true, vercel: true, netlify: false, render: true },
  { feature: "Runtime application logs", hostack: true, vercel: false, netlify: false, render: true },
  { feature: "Built-in metrics dashboard", hostack: true, vercel: true, netlify: false, render: true },
  { feature: "SSH deploy key support", hostack: true, vercel: false, netlify: false, render: false },
  { feature: "AI copilot for deployments", hostack: true, vercel: false, netlify: false, render: false },
  { feature: "AI build config suggestions", hostack: true, vercel: false, netlify: false, render: false },
  { feature: "Transparent build engine", hostack: true, vercel: false, netlify: false, render: false },
  { feature: "Slack & Discord notifications", hostack: true, vercel: true, netlify: true, render: false },
  { feature: "Sentry integration", hostack: true, vercel: true, netlify: false, render: false },
  { feature: "Cloudflare DNS integration", hostack: true, vercel: false, netlify: false, render: false },
  { feature: "Open source components", hostack: true, vercel: false, netlify: false, render: false },
  { feature: "Free tier available", hostack: true, vercel: true, netlify: true, render: true },
];

const PLATFORM_SUMMARIES = [
  {
    name: "Vercel",
    description: "The gold standard for frontend deployments. Excellent developer experience, global edge network, and deep Next.js integration. Limited observability beyond build logs, no SSH key support, and AI features are nascent.",
    verdict: "Best for: Next.js teams who don't need deep runtime observability.",
  },
  {
    name: "Netlify",
    description: "Pioneer of the JAMstack deployment model. Strong for static sites and serverless functions. Build logs are basic, no runtime log access, and the platform has aged compared to newer entrants.",
    verdict: "Best for: Static sites and simple serverless workloads.",
  },
  {
    name: "Render",
    description: "Full-stack platform with good support for Node.js services, databases, and background workers. Solid observability but no AI features, no SSH key support, and the UI can feel cluttered.",
    verdict: "Best for: Full-stack apps needing managed databases alongside deployments.",
  },
];

export default function Compare() {
  const { isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();

  const handleCTA = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
      return;
    }
    login("/dashboard");
  };

  return (
    <PublicPageShell
      eyebrow="Compare"
      title="Hostack vs the alternatives."
      description="See how Hostack stacks up against Vercel, Netlify, and Render across the features that matter most for modern deployment workflows."
    >
      <section className="mb-12">
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="px-6 py-4 text-left font-medium text-zinc-400">Feature</th>
                <th className="px-6 py-4 text-center font-semibold text-violet-400">Hostack</th>
                <th className="px-6 py-4 text-center font-medium text-zinc-400">Vercel</th>
                <th className="px-6 py-4 text-center font-medium text-zinc-400">Netlify</th>
                <th className="px-6 py-4 text-center font-medium text-zinc-400">Render</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/30"}`}
                >
                  <td className="px-6 py-3.5 text-zinc-300">{row.feature}</td>
                  <td className="px-6 py-3.5 text-center">
                    {row.hostack ? (
                      <Check aria-label="Yes" className="mx-auto h-5 w-5 text-violet-400" />
                    ) : (
                      <X aria-label="No" className="mx-auto h-5 w-5 text-red-400/50" />
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {row.vercel ? (
                      <Check aria-label="Yes" className="mx-auto h-5 w-5 text-zinc-400" />
                    ) : (
                      <X aria-label="No" className="mx-auto h-5 w-5 text-red-400/50" />
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {row.netlify ? (
                      <Check aria-label="Yes" className="mx-auto h-5 w-5 text-zinc-400" />
                    ) : (
                      <X aria-label="No" className="mx-auto h-5 w-5 text-red-400/50" />
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {row.render ? (
                      <Check aria-label="Yes" className="mx-auto h-5 w-5 text-zinc-400" />
                    ) : (
                      <X aria-label="No" className="mx-auto h-5 w-5 text-red-400/50" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">Platform Summaries</h2>
        <div className="space-y-4">
          {PLATFORM_SUMMARIES.map((platform) => (
            <Card key={platform.name}>
              <CardHeader>
                <CardTitle className="text-white">{platform.name}</CardTitle>
                <CardDescription>{platform.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-violet-400">{platform.verdict}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <Card className="border-violet-500/20 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-white">Where Hostack wins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-zinc-300">
            <p>
              Hostack is the only platform in this comparison that combines AI-native deployment intelligence with deep runtime observability and transparent build execution. While Vercel and Netlify excel at the deployment UX, they treat the build engine as a black box.
            </p>
            <p>
              For teams that need to understand <em>why</em> a deployment behaved a certain way—not just whether it succeeded—Hostack provides the runtime logs, metrics, and AI context that others don't.
            </p>
            <p>
              SSH deploy key support is a meaningful differentiator for teams with private repositories who don't want to share personal access tokens or manage organization-level credentials.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-zinc-900">
          <CardContent className="py-12 text-center">
            <h2 className="mb-4 text-3xl font-semibold text-white">Try Hostack for free</h2>
            <p className="mb-8 text-lg text-zinc-400">
              No credit card required. Deploy your first project in under two minutes.
            </p>
            <Button size="lg" onClick={handleCTA} className="h-12 px-10 text-base">
              {isAuthenticated ? "Go to Dashboard" : "Get Started Free"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </PublicPageShell>
  );
}
