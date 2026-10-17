import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GoogleButton } from "@/components/GoogleButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Private Notes — your rows, only yours" },
      { name: "description", content: "Sign in with Google and keep notes nobody else can read or edit." },
      { property: "og:title", content: "Private Notes — your rows, only yours" },
      { property: "og:description", content: "Sign in with Google and keep notes nobody else can read or edit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">Private Notes</p>
      <h1 className="font-display text-5xl font-bold leading-tight">
        Your notes. Enforced by the database, not by hope.
      </h1>
      <p className="text-lg text-muted-foreground">
        Every row belongs to the person who wrote it. Row-level security makes sure no one else can
        read, change, or delete it.
      </p>
      {signedIn ? (
        <Button asChild size="lg" className="self-start">
          <Link to="/notes">Open my notes</Link>
        </Button>
      ) : (
        <GoogleButton />
      )}
    </main>
  );
}
