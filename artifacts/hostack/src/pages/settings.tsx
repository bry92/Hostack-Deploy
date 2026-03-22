import { ProtectedLayout } from "@/components/layout/protected-layout";
import { AppPage, AppPageHeader, AppPageSection } from "@/components/layout/app-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/auth-web";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  return (
    <ProtectedLayout>
      <AppPage className="max-w-5xl">
        <AppPageHeader
          eyebrow="Settings"
          icon={<SettingsIcon className="h-5 w-5" />}
          title="Account Settings"
          description="Review identity information, platform preferences, and the account-level controls that shape your Hostack workspace."
        />

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your personal information is managed through the configured identity provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6 pb-6 border-b border-border/50">
              <Avatar className="w-20 h-20 border-2 border-border shadow-lg">
                <AvatarImage src={user?.profileImage ?? undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-medium">
                  {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : user?.email?.split('@')[0] || 'User'}
                </h3>
                <p className="text-muted-foreground">Managed via your identity provider</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : ''} disabled className="bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || "Not provided"} disabled className="bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={user?.firstName || ""} disabled className="bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={user?.lastName || ""} disabled className="bg-muted/30" />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              To update this information, please modify your Replit account profile.
            </p>
          </CardContent>
        </Card>

        <AppPageSection className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50 bg-card/30">
            <CardHeader>
              <CardTitle>Billing & Plan</CardTitle>
              <CardDescription>Manage your subscription (Coming Phase 2)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div>
                  <div className="font-medium text-primary">Hobby Plan</div>
                  <div className="text-sm text-muted-foreground">Free forever</div>
                </div>
                <Button variant="outline" disabled>Upgrade</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/30">
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
