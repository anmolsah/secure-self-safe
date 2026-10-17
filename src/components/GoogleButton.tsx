import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";

export function GoogleButton() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    window.location.assign("/notes");
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="lg" onClick={signIn} disabled={busy}>
        {busy ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
