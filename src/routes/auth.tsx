import { createFileRoute } from "@tanstack/react-router";
import { GoogleButton } from "@/components/GoogleButton";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Private Notes" },
      { name: "description", content: "Sign in with Google to access your private notes." },
      { property: "og:title", content: "Sign in — Private Notes" },
      { property: "og:description", content: "Sign in with Google to access your private notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="font-display text-4xl font-bold">Sign in</h1>
      <p className="text-muted-foreground">Use your Google account to reach your notes.</p>
      <GoogleButton />
    </main>
  );
}
