import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Careers() {
  return (
    <PublicPageShell
      eyebrow="Careers"
      title="Small team, hard problems, no fake hiring page."
      description="Aetheria Build Flow is still early. We are not listing open roles yet, but the kind of work we care about is already clear."
    >
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Systems thinking</CardTitle>
            <CardDescription>Control planes, workers, queue semantics, runtime activation, and recovery paths.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Product discipline</CardTitle>
            <CardDescription>Fast developer experience matters, but only if the operational model remains understandable.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Honest software</CardTitle>
            <CardDescription>No fake automation, no hidden steps, and no pretending reliability appears after launch.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-white">How to get on the radar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-400">
          <p>There are no open public roles today. If that changes, this page will carry the real openings.</p>
          <p>Until then, the best signal is thoughtful product or engineering feedback, reproducible bug reports, and strong technical reasoning on the platform direction.</p>
        </CardContent>
      </Card>
    </PublicPageShell>
  );
}
