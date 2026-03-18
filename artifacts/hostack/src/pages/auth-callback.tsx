import { useEffect } from "react";

export default function AuthCallback() {
  useEffect(() => {
    const query = window.location.search ?? "";
    window.location.replace(`/api/callback${query}`);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Completing sign-in...</p>
    </div>
  );
}
