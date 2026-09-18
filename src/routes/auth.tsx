import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — The AI Brief" },
      {
        name: "description",
        content: "Sign in to save a default filter view or review the spot-check queue.",
      },
      { property: "og:title", content: "Sign in — The AI Brief" },
      {
        property: "og:description",
        content: "Sign in to save a default filter view or review flagged stories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.success("Check your email to confirm your account.");
        return;
      }
      navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate({ to: "/" });
    }
  };

  const google = async (): Promise<void> => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold">
        {mode === "signin" ? "Sign in" : "Create an account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reading the feed needs no account. Sign in to save a default filter view, or to review
        flagged stories if you are an editor.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="w-full" onClick={google}>
        Continue with Google
      </Button>

      <button
        type="button"
        className="mt-6 w-full text-sm text-muted-foreground underline underline-offset-4"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "Don't have an account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
