import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import type { Filters } from "@/lib/news";

export function DigestSignup({ filters }: { filters: Filters }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Please tick the consent box before signing up.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("digest_subscribers").insert({
      email: email.trim().toLowerCase(),
      consented_at: new Date().toISOString(),
      filter_preferences: JSON.parse(JSON.stringify(filters)),
      unsubscribed: false,
    });
    setSubmitting(false);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "That email is already signed up."
          : "Sign-up failed. Please try again.",
      );
      return;
    }
    setDone(true);
    toast.success("You're signed up for the digest.");
  };

  return (
    <section className="rounded-lg border border-border bg-secondary/50 p-6">
      <h2 className="font-serif text-xl font-semibold text-foreground">Get this feed by email</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We'll send a digest matching the filters you have selected right now.
      </p>

      {done ? (
        <p className="mt-4 text-sm font-medium text-foreground">
          Thanks — your digest preferences have been saved.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-background"
            aria-label="Email address"
          />
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
            />
            <span>
              I agree to receive the email digest and to the{" "}
              <Link to="/privacy" className="underline underline-offset-4">
                privacy policy
              </Link>
              .
            </span>
          </label>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing up…" : "Sign up for the digest"}
          </Button>
        </form>
      )}
    </section>
  );
}
