import { motion } from "framer-motion";
import { Check, Flame, Zap, FileText, Crown, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { AppNav } from "@/components/AppNav";
import { useMe, useStripeProducts, useCheckout, usePortal } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";

const FREE_FEATURES = [
  "2 receipt uploads per month",
  "AI roast for each receipt",
  "Shareable roast card",
  "Basic expense extraction",
];

const PREMIUM_FEATURES = [
  "Unlimited receipt uploads",
  "Upload CSV bank statements",
  "AI categorizes all transactions",
  "Full spending history & charts",
  "Monthly roast summary",
  "AI financial advice",
  "Choose your roast tone",
  "Priority roast generation",
];

const ANNUAL_FEATURES = [
  "Full year spending analysis",
  "Top 5 spending categories",
  "Worst month identified",
  "Brutal honesty AI roast",
  "Behavioral spending analysis",
  "5-year projection if unchanged",
  "3 custom improvement suggestions",
  "Downloadable PDF report",
];

function TierBadge({ tier }: { tier?: string }) {
  if (!tier || tier === "free") return null;
  return (
    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-bold border border-[hsl(var(--primary))]/30">
      Current Plan
    </span>
  );
}

export default function Pricing() {
  const { data: me } = useMe();
  const { data: products, isLoading: productsLoading } = useStripeProducts();
  const checkoutMutation = useCheckout();
  const portalMutation = usePortal();
  const { toast } = useToast();

  const premiumPrice = products?.find((p: any) => p.price_metadata?.plan === "premium" || p.metadata?.plan === "premium");
  const annualPrice = products?.find((p: any) => p.price_metadata?.plan === "annual_report" || p.metadata?.plan === "annual_report");

  const isPremium = me?.tier === "premium";
  const hasAnnualReport = me?.hasAnnualReport;

  const handleCheckout = (priceId: string, mode?: string) => {
    if (!priceId) {
      toast({ title: "Not available", description: "Product not configured yet.", variant: "destructive" });
      return;
    }
    checkoutMutation.mutate({ priceId, mode });
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-noise" />
      <AppNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-14">
          <Link href="/upload" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to app
          </Link>
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center mx-auto mb-6">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-5xl font-display font-black text-white mb-4">Choose Your Roast Level</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From gentle nudges to full financial demolition — pick the plan that matches how much truth you can handle.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Tier */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-panel rounded-3xl p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-6 h-6 text-muted-foreground" />
                <h2 className="text-2xl font-display font-bold text-white">Free</h2>
                {me?.tier === "free" && <TierBadge tier="free" />}
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-display font-black text-white">$0</span>
                <span className="text-muted-foreground mb-1">/month</span>
              </div>
              <p className="text-muted-foreground text-sm">Dip your toes in the shame.</p>
            </div>
            <ul className="flex flex-col gap-3 flex-1 mb-8">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-[hsl(var(--secondary))] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-center text-sm text-muted-foreground font-semibold">
              {me?.tier === "free" ? "Current Plan" : "Default"}
            </div>
          </motion.div>

          {/* Premium Tier */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="relative glass-panel rounded-3xl p-8 flex flex-col border border-[hsl(var(--primary))]/40">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white text-xs font-black uppercase tracking-wider">
                Most Popular
              </span>
            </div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-6 h-6 text-[hsl(var(--primary))]" />
                <h2 className="text-2xl font-display font-bold text-white">Premium</h2>
                {isPremium && <TierBadge tier="premium" />}
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-display font-black text-white">$9.99</span>
                <span className="text-muted-foreground mb-1">/month</span>
              </div>
              <p className="text-muted-foreground text-sm">Full financial demolition mode.</p>
            </div>
            <ul className="flex flex-col gap-3 flex-1 mb-8">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white">
                  <Check className="w-4 h-4 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            {isPremium ? (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-subscription"
                className="w-full px-6 py-4 rounded-2xl font-display font-bold text-white bg-white/10 border border-white/20 hover:bg-white/15 transition-all duration-200 flex items-center justify-center gap-2"
              >
                {portalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Manage Subscription
              </button>
            ) : (
              <button
                onClick={() => handleCheckout(premiumPrice?.price_id || "", "subscription")}
                disabled={checkoutMutation.isPending || productsLoading}
                data-testid="button-upgrade-premium"
                className="w-full px-6 py-4 rounded-2xl font-display font-bold text-white bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] btn-glow hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2"
              >
                {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Upgrade to Premium
              </button>
            )}
          </motion.div>

          {/* Annual Report */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-panel rounded-3xl p-8 flex flex-col border border-[hsl(var(--accent))]/30">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-6 h-6 text-[hsl(var(--accent))]" />
                <h2 className="text-2xl font-display font-bold text-white">Annual Report</h2>
                {hasAnnualReport && <TierBadge tier="annual" />}
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-display font-black text-white">$29.99</span>
                <span className="text-muted-foreground mb-1">once</span>
              </div>
              <p className="text-muted-foreground text-sm">One-time. Full year. No mercy.</p>
            </div>
            <ul className="flex flex-col gap-3 flex-1 mb-8">
              {ANNUAL_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white">
                  <Check className="w-4 h-4 text-[hsl(var(--accent))] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            {hasAnnualReport ? (
              <Link href="/annual-report">
                <button
                  data-testid="button-view-report"
                  className="w-full px-6 py-4 rounded-2xl font-display font-bold text-white bg-[hsl(var(--accent))]/20 border border-[hsl(var(--accent))]/40 hover:bg-[hsl(var(--accent))]/30 transition-all duration-200"
                >
                  View Your Report
                </button>
              </Link>
            ) : (
              <button
                onClick={() => handleCheckout(annualPrice?.price_id || "", "payment")}
                disabled={checkoutMutation.isPending || productsLoading}
                data-testid="button-buy-annual"
                className="w-full px-6 py-4 rounded-2xl font-display font-bold text-white bg-gradient-to-r from-[hsl(var(--accent))]/80 to-[hsl(var(--primary))]/80 hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2"
              >
                {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Get Annual Report
              </button>
            )}
          </motion.div>
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-center text-muted-foreground text-sm mt-10">
          Payments are secure and processed by Stripe. Cancel Premium anytime from the billing portal.
        </motion.p>
      </main>
    </div>
  );
}
