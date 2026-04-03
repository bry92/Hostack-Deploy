import { ProtectedLayout } from "@/components/layout/protected-layout";
import { AppPage, AppPageHeader, AppPageSection } from "@/components/layout/app-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/auth-web";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [billingStatus, setBillingStatus] = useState<"idle" | "loading" | "error">("idle");

  const handleManageSubscription = async () => {
    setBillingStatus("loading");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("billing_portal_failed");
      }

      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("missing_portal_url");
    } catch (error) {
      console.error("Failed to open billing portal", error);
      setBillingStatus("error");
    }
  };

  return (
    <ProtectedLayout>
      <AppPage className="max-w-5xl">
        <AppPageHeader
          eyebrow="Settings"
          icon={<SettingsIcon className="h-5 w-5" />}
          title="Account Settings"
          description="Review identity information, platform preferences, and the account-level controls that shape your Hostack workspace."
        />

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your personal information is managed through the configured identity provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6 border-b border-zinc-800 pb-6">
              <Avatar className="h-20 w-20 border border-zinc-800 shadow-sm">
                <AvatarImage src={user?.profileImage ?? undefined} />
                <AvatarFallback className="bg-violet-500/10 text-2xl text-violet-400">
                  {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-medium text-white">
                  {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : user?.email?.split('@')[0] || 'User'}
                </h3>
                <p className="text-zinc-400">Managed via your identity provider</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : ''} disabled className="bg-zinc-950" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || "Not provided"} disabled className="bg-zinc-950" />
              </div>
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={user?.firstName || ""} disabled className="bg-zinc-950" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={user?.lastName || ""} disabled className="bg-zinc-950" />
              </div>
            </div>
            
            <p className="mt-4 text-sm text-zinc-400">
              To update this information, please modify your Replit account profile.
            </p>
          </CardContent>
        </Card>

        <AppPageSection className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Plan</CardTitle>
              <CardDescription>Manage your subscription and plan details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div>
                  <div className="font-medium text-white">Hobby Plan</div>
                  <div className="text-sm text-zinc-400">Free forever</div>
                </div>
                <Button variant="outline" onClick={handleManageSubscription} disabled={billingStatus === "loading"}>
                  {billingStatus === "loading" ? "Opening..." : "Manage Subscription"}
                </Button>
              </div>
              {billingStatus === "error" ? (
                <p className="mt-3 text-sm text-red-400">
                  Unable to open the billing portal. Please try again.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Tokens</CardTitle>
              <CardDescription>Generate tokens for CLI usage (Coming Phase 2)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full border-dashed" disabled>Generate New Token</Button>
            </CardContent>
          </Card>
        </AppPageSection>
      </AppPage>
    </ProtectedLayout>
  );
}
