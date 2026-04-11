import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Github } from "lucide-react";

interface AuthProvider {
  name: string;
  id: string;
  enabled: boolean;
  loginUrl: string;
}

interface LoginChooserProps {
  returnTo?: string;
  onClose?: () => void;
}

/**
 * Login Chooser Component
 * 
 * Displays available OAuth providers (Auth0, GitHub, etc.)
 * Users can choose which provider to use for login
 */
export function LoginChooser({ returnTo = "/dashboard", onClose }: LoginChooserProps) {
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((data) => {
        setProviders(data.providers || []);
      })
      .catch((error) => {
        console.error("Failed to fetch auth providers", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogin = (provider: AuthProvider) => {
    const url = new URL(provider.loginUrl, window.location.origin);
    url.searchParams.set("returnTo", returnTo);
    window.location.href = url.href;
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Loading...</h2>
      </Card>
    );
  }

  if (providers.length === 0) {
    return (
      <Card className="w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">No auth providers available</h2>
        <p className="text-sm text-zinc-400">
          Please contact support to enable authentication
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Sign in to Hostack</h2>
        <p className="text-sm text-zinc-400">Choose your preferred authentication method</p>
      </div>

      <div className="space-y-3">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            onClick={() => handleLogin(provider)}
            disabled={!provider.enabled}
            variant="outline"
            className="w-full h-10"
          >
            {provider.id === "github" && <Github className="w-4 h-4 mr-2" />}
            Sign in with {provider.name}
          </Button>
        ))}
      </div>

      {onClose && (
        <Button onClick={onClose} variant="ghost" className="w-full">
          Cancel
        </Button>
      )}
    </Card>
  );
}
