import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import {
  TOPICS,
  topicClass,
  topicOutlineClass,
  type Filters,
  type Topic,
} from "@/lib/news";

type Tier = "free-weekly" | "paid-daily";
type Plan = "yearly" | "monthly";

export function DigestSignup({ filters }: { filters: Filters }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [allTopics, setAllTopics] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tier, setTier] = useState<Tier>("paid-daily");
  const [plan, setPlan] = useState<Plan>("yearly");
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "revolut">("paypal");

  const toggleTopic = (topic: Topic) => {
    setAllTopics(false);
    setSelectedTopics((current) =>
      current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic],
    );
  };

  const saveSubscription = async () => {
    setSubmitting(true);
    const { error } = await supabase.from("digest_subscribers").insert({
      email,
      consented_at: new Date().toISOString(),
      unsubscribed: false,
      filter_preferences: {
        all_topics: allTopics,
        topics: allTopics ? [...TOPICS] : selectedTopics,
        tone: filters.tone,
        access: filters.access,
        geography: filters.geography,
        tier,
        cadence: tier === "free-weekly" ? "weekly" : "daily",
        plan: tier === "free-weekly" ? "free" : plan,
        payment_method: tier === "free-weekly" ? null : paymentMethod,
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "That email is already subscribed."
          : "We couldn't save your subscription. Please try again.",
      );
      return false;
    }

    setEmail("");
    setConsent(false);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!consent) {
      toast.error("Please tick the consent box before subscribing.");
      return;
    }
    if (!allTopics && selectedTopics.length === 0) {
      toast.error("Choose at least one topic, or select Everything.");
      return;
    }
    if (tier === "free-weekly") {
      const ok = await saveSubscription();
      if (ok) toast.success("You're subscribed to the Free Weekly Digest.");
      return;
    }
    setCheckoutOpen(true);
  };

  const completePreview = async () => {
    const ok = await saveSubscription();
    if (!ok) return;
    setCheckoutOpen(false);
    toast.success("Preferences saved. Checkout is still a preview, so no payment was taken.");
  };

  const submitLabel =
    tier === "free-weekly"
      ? "Subscribe free — Weekly Digest"
      : `Continue to Subscribe — ${plan === "yearly" ? "€25/yr" : "€3/mo"}`;

  return (
    <section className="overflow-hidden rounded-md border border-border bg-card/60">
      <div className="border-b border-border px-6 py-6 sm:px-8">
        <p className="text-xs font-semibold tracking-widest text-digest-foreground uppercase">
          TheFullPicture.ai digest
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-foreground">The brief, in your inbox</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Pick free weekly or paid daily, choose what you want to follow. Every story arrives with its sources linked.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 p-6 sm:p-8">
        <fieldset>
          <legend className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Choose your digest
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTier("free-weekly")}
              className={`rounded-md border p-4 text-left transition-colors ${
                tier === "free-weekly" ? "border-foreground ring-1 ring-foreground" : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center justify-between">
                <strong className="font-serif text-lg">Free Weekly Digest</strong>
                {tier === "free-weekly" && <Check className="size-4" />}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">€0 — one considered round-up each week.</span>
            </button>

            <button
              type="button"
              onClick={() => setTier("paid-daily")}
              className={`rounded-md border p-4 text-left transition-colors ${
                tier === "paid-daily" ? "border-foreground ring-1 ring-foreground" : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center justify-between">
                <strong className="font-serif text-lg">Daily Digest</strong>
                {tier === "paid-daily" && <Check className="size-4" />}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                From €2.08/mo — the full picture, every morning.
              </span>
            </button>
          </div>

          {tier === "paid-daily" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPlan("yearly")}
                className={`flex items-center justify-between rounded-md border px-4 py-3 text-left text-sm ${
                  plan === "yearly" ? "border-plan-yearly bg-plan-yearly text-tone-contrast" : "border-border hover:bg-muted/50"
                }`}
              >
                <span>
                  <strong className="block">€25/year</strong>
                  <span className="opacity-80">(€2.08/mo)</span>
                </span>
                <span className={`px-2 py-1 text-[0.65rem] font-semibold uppercase ${plan === "yearly" ? "bg-background text-plan-yearly" : "text-muted-foreground"}`}>
                  Best value
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPlan("monthly")}
                className={`rounded-md border px-4 py-3 text-left text-sm ${
                  plan === "monthly" ? "border-plan-monthly bg-plan-monthly text-tone-contrast" : "border-border hover:bg-muted/50"
                }`}
              >
                <strong className="block">€3/month</strong>
                <span className="opacity-80">Billed monthly</span>
              </button>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Topics in your brief
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={allTopics ? "default" : "outline"}
              className={allTopics ? "bg-filter-active text-tone-contrast hover:bg-filter-active/90" : ""}
              onClick={() => {
                setAllTopics(true);
                setSelectedTopics([]);
              }}
            >
              {allTopics && <Check />}
              All Topics / Everything
            </Button>
            {TOPICS.map((topic) => {
              const active = !allTopics && selectedTopics.includes(topic);
              return (
                <Button
                  key={topic}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={active ? topicClass[topic] : topicOutlineClass[topic]}
                  onClick={() => toggleTopic(topic)}
                >
                  {active && <Check />}
                  {topic}
                </Button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="digest-email" className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Email address
          </label>
          <Input
            id="digest-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 bg-background"
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} className="mt-0.5" />
          <span>
            I agree to receive the TheFullPicture.ai digest and to the{" "}
            <Link to="/privacy" className="underline underline-offset-4">privacy policy</Link>.
          </span>
        </label>

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full bg-primary text-primary-foreground shadow-none hover:bg-brand-accent"
        >
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </form>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-none sm:rounded-md">
          <DialogHeader>
            <p className="text-xs font-semibold tracking-widest text-digest-foreground uppercase">Checkout</p>
            <DialogTitle className="font-serif text-2xl">Complete your subscription</DialogTitle>
            <DialogDescription>
              Choose your billing schedule and payment method for {email}.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="mt-2">
            <legend className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Daily Digest plan</legend>
            <RadioGroup value={plan} onValueChange={(value) => setPlan(value as Plan)} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-3 border p-4 ${plan === "yearly" ? "border-plan-yearly bg-plan-yearly text-tone-contrast" : "border-border"}`}>
                <RadioGroupItem value="yearly" />
                <span className="flex-1"><strong className="block">Yearly</strong><span className="text-sm opacity-80">€25/year (€2.08/mo)</span></span>
                <span className="bg-background px-2 py-1 text-[0.65rem] font-semibold text-plan-yearly uppercase">Best value</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 border p-4 ${plan === "monthly" ? "border-plan-monthly bg-plan-monthly text-tone-contrast" : "border-border"}`}>
                <RadioGroupItem value="monthly" />
                <span><strong className="block">Monthly</strong><span className="text-sm opacity-80">€3 per month</span></span>
              </label>
            </RadioGroup>
          </fieldset>

          <fieldset className="mt-2">
            <legend className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Payment method</legend>
            <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "paypal" | "revolut")} className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["paypal", "revolut"] as const).map((method) => {
                const active = paymentMethod === method;
                return (
                  <label key={method} className={`flex cursor-pointer items-center gap-3 border p-4 font-semibold ${active ? method === "paypal" ? "border-payment-paypal bg-payment-paypal text-tone-contrast" : "border-payment-revolut bg-payment-revolut text-tone-contrast" : "border-border"}`}>
                    <RadioGroupItem value={method} />
                    {method === "paypal" ? "PayPal" : "Revolut Pay"}
                    {active && <Check className="ml-auto" />}
                  </label>
                );
              })}
            </RadioGroup>
          </fieldset>

          <Button onClick={completePreview} disabled={submitting} className="mt-3 h-11 w-full">
            <CreditCard />
            {submitting ? "Saving…" : `Continue with ${paymentMethod === "paypal" ? "PayPal" : "Revolut Pay"} · ${plan === "yearly" ? "€25/year (€2.08/mo)" : "€3/month"}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Checkout preview — no payment will be taken.</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
