import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Filters } from "@/lib/news";

export function DigestSignup({ filters }: { filters: Filters }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<"yearly" | "monthly">("yearly");
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "revolut">("paypal");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Please tick the consent box before signing up.");
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      toast.info("Checkout preview only — payments are not active yet.");
    }, 500);
  };

  return (
    <section className="overflow-hidden border border-border bg-background">
      <div className="border-b border-border bg-background px-6 py-5 sm:px-8">
        <p className="text-xs font-semibold tracking-widest text-digest-foreground uppercase">Paid digest</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-foreground">The brief, in your inbox</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          A focused digest matching the filters you selected, with every source linked.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-6 p-6 sm:p-8">
          <fieldset>
            <legend className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Choose a plan</legend>
            <RadioGroup value={plan} onValueChange={(value) => setPlan(value as "yearly" | "monthly")} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={`relative flex cursor-pointer items-center gap-3 border p-4 transition-colors ${plan === "yearly" ? "border-plan-yearly bg-plan-yearly text-tone-contrast" : "border-border bg-background"}`}>
                <RadioGroupItem value="yearly" />
                <span className="flex-1">
                  <span className={`block font-semibold ${plan === "yearly" ? "text-tone-contrast" : "text-foreground"}`}>Yearly</span>
                  <span className={`block text-sm ${plan === "yearly" ? "text-tone-contrast/80" : "text-muted-foreground"}`}>€25 per year</span>
                </span>
                <span className="bg-background px-2 py-1 text-[0.65rem] font-semibold tracking-wide text-plan-yearly uppercase">Best value</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 border p-4 transition-colors ${plan === "monthly" ? "border-plan-monthly bg-plan-monthly text-tone-contrast" : "border-border bg-background"}`}>
                <RadioGroupItem value="monthly" />
                <span>
                  <span className={`block font-semibold ${plan === "monthly" ? "text-tone-contrast" : "text-foreground"}`}>Monthly</span>
                  <span className={`block text-sm ${plan === "monthly" ? "text-tone-contrast/80" : "text-muted-foreground"}`}>€3 per month</span>
                </span>
              </label>
            </RadioGroup>
          </fieldset>

          <div>
            <label htmlFor="digest-email" className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Email address</label>
          <Input
            id="digest-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-2 bg-background"
            aria-label="Email address"
          />
          </div>

          <fieldset>
            <legend className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Payment method</legend>
            <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "paypal" | "revolut")} className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["paypal", "revolut"] as const).map((method) => (
                <label key={method} className={`flex cursor-pointer items-center gap-3 border p-4 font-semibold transition-colors ${paymentMethod === method ? (method === "paypal" ? "border-payment-paypal bg-payment-paypal text-tone-contrast" : "border-payment-revolut bg-payment-revolut text-tone-contrast") : "border-border bg-background"}`}>
                  <RadioGroupItem value={method} />
                  <span className={paymentMethod === method ? "text-tone-contrast" : method === "paypal" ? "text-payment-paypal" : "text-payment-revolut"}>
                    {method === "paypal" ? "PayPal" : "Revolut Pay"}
                  </span>
                  {paymentMethod === method && <Check className="ml-auto h-4 w-4 text-tone-contrast" />}
                </label>
              ))}
            </RadioGroup>
          </fieldset>

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
          <Button type="submit" disabled={submitting} className="h-11 w-full bg-digest-foreground text-primary-foreground hover:bg-digest-foreground/90">
            <CreditCard className="h-4 w-4" />
            {submitting ? "Opening checkout…" : `Continue with ${paymentMethod === "paypal" ? "PayPal" : "Revolut Pay"} · ${plan === "yearly" ? "€25/year" : "€3/month"}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Checkout preview — no payment will be taken.</p>
        </form>
    </section>
  );
}
