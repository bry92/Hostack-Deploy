import { useEffect } from "react";

export default function AuthCallback() {
  useEffect(() => {
    const query = window.location.search ?? "";
    window.location.replace(`/api/callback${query}`);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400 shadow-sm">
        Completing sign-in...
      </div>
    </div>
  );
}
