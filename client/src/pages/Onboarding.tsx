import { useState } from "react";
import { useLocation } from "wouter";
import { AppLogo } from "@/components/AppLogo";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency, CURRENCIES } from "@/hooks/use-currency";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { syncFromServer } = useCurrency();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [currency, setCurrencyLocal] = useState("USD");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) {
      toast({ title: "First name is required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest("PATCH", "/api/me/profile", {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        currency,
        onboardingComplete: true,
      });
      syncFromServer(currency);
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      navigate("/upload");
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <AppLogo size="lg" />
          </div>
          <p className="text-muted-foreground text-sm text-center">
            Let's get you set up before the roasting begins.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="onboarding-first-name" className="text-sm font-semibold text-white/80">
              First name <span className="text-[hsl(var(--primary))]">*</span>
            </label>
            <input
              id="onboarding-first-name"
              data-testid="input-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="What should we call you?"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[hsl(var(--primary))]/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="onboarding-last-name" className="text-sm font-semibold text-white/80">
              Last name <span className="text-white/30 text-xs font-normal">(optional)</span>
            </label>
            <input
              id="onboarding-last-name"
              data-testid="input-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[hsl(var(--primary))]/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="onboarding-currency" className="text-sm font-semibold text-white/80">
              Currency
            </label>
            <select
              id="onboarding-currency"
              data-testid="select-onboarding-currency"
              value={currency}
              onChange={(e) => setCurrencyLocal(e.target.value)}
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm cursor-pointer focus:outline-none focus:border-[hsl(var(--primary))]/50 transition-colors"
            >
              {CURRENCIES.map(({ code, label }) => (
                <option key={code} value={code} className="bg-[#121212] text-white">{label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            data-testid="button-onboarding-submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {isSubmitting ? "Setting up..." : "Let's get roasting 🔥"}
          </button>
        </form>
      </div>
    </div>
  );
}
