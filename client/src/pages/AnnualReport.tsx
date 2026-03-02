import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Flame, TrendingUp, Calendar, Target, Download, AlertTriangle, Loader2, Lock } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { useMe, useAnnualReport } from "@/hooks/use-subscription";
import { useCheckout, useStripeProducts } from "@/hooks/use-subscription";
import { Link } from "wouter";

function fmtCurrency(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtMonth(ym: string) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function AnnualReport() {
  const { data: me } = useMe();
  const { data: products } = useStripeProducts();
  const checkoutMutation = useCheckout();
  const reportMutation = useAnnualReport();
  const reportRef = useRef<HTMLDivElement>(null);
  const [reportData, setReportData] = useState<any>(null);

  const canAccess = me?.hasAnnualReport || me?.tier === "premium";
  const annualPrice = products?.find((p: any) => p.price_metadata?.plan === "annual_report" || p.metadata?.plan === "annual_report");

  const handleGenerate = () => {
    reportMutation.mutate(undefined, {
      onSuccess: (data) => setReportData(data),
    });
  };

  const handleDownload = () => {
    if (!reportRef.current) return;
    window.print();
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen pb-24">
        <div className="bg-noise" />
        <AppNav />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Annual Roast Report</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Get a full year of financial analysis with brutal honesty, behavioral insights, and a 5-year projection. One-time purchase, no subscription needed.
            </p>
            <div className="glass-panel rounded-3xl p-8 mb-6 text-left">
              <div className="text-5xl font-amount-card text-white mb-1">$29.99</div>
              <div className="text-muted-foreground mb-6">One-time payment</div>
              <ul className="flex flex-col gap-3 mb-8">
                {["Brutal full-year roast", "Behavioral spending analysis", "Top 5 spending categories", "Worst month identified", "5-year projection if you don't change", "3 custom improvement suggestions", "Downloadable PDF"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white">
                    <Flame className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => checkoutMutation.mutate({ priceId: annualPrice?.price_id || "", mode: "payment" })}
                disabled={checkoutMutation.isPending}
                data-testid="button-buy-annual-report"
                className="w-full px-6 py-4 rounded-2xl font-display font-bold text-white bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] btn-glow hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                {checkoutMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Get My Annual Roast Report — $29.99
              </button>
            </div>
            <Link href="/pricing" className="text-muted-foreground hover:text-white transition-colors text-sm">
              View all plans →
            </Link>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-noise" />
      <AppNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--accent))]/20 border border-[hsl(var(--accent))]/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[hsl(var(--accent))]" />
              </div>
              <h1 className="text-4xl font-bold text-white">Annual Roast Report</h1>
            </div>
            {reportData && (
              <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all text-sm font-semibold text-white" data-testid="button-download-report">
                <Download className="w-4 h-4" /> Download PDF
              </button>
            )}
          </div>
          <p className="text-muted-foreground mt-2 text-lg">The full financial post-mortem. No sugarcoating.</p>
        </motion.div>

        {!reportData ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-3xl p-16 text-center">
            <div className="w-20 h-20 rounded-full bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 flex items-center justify-center mx-auto mb-6">
              <Flame className="w-10 h-10 text-[hsl(var(--primary))]" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Ready to face the truth?</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              This will analyze all your saved expenses and generate a comprehensive financial roast. Requires at least a few transactions.
            </p>
            {reportMutation.isError && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-6 max-w-md mx-auto">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm text-muted-foreground">{(reportMutation.error as Error)?.message}</p>
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={reportMutation.isPending}
              data-testid="button-generate-report"
              className="px-10 py-5 rounded-2xl font-display font-bold text-xl text-white bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] btn-glow hover:opacity-90 transition-all flex items-center gap-3 mx-auto"
            >
              {reportMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Flame className="w-6 h-6" />}
              {reportMutation.isPending ? "Analyzing your financial sins..." : "Generate My Annual Report"}
            </button>
          </motion.div>
        ) : (
          <div ref={reportRef} className="flex flex-col gap-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Spent", value: fmtCurrency(reportData.totalSpend), icon: TrendingUp, color: "primary" },
                { label: "Monthly Avg", value: fmtCurrency(reportData.avgMonthlySpend), icon: Calendar, color: "secondary" },
                { label: "5-Year Projection", value: fmtCurrency(reportData.projection5yr), icon: Target, color: "destructive" },
                { label: "Worst Month", value: reportData.worstMonth?.month ? fmtMonth(reportData.worstMonth.month) : "N/A", icon: Flame, color: "accent" },
              ].map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="glass-panel rounded-2xl p-5">
                  <div className={`w-8 h-8 rounded-xl mb-3 flex items-center justify-center bg-[hsl(var(--${stat.color}))]/20`}>
                    <stat.icon className={`w-4 h-4 text-[hsl(var(--${stat.color}))]`} />
                  </div>
                  <div className="text-xl font-amount-card text-white">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Top categories */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-panel rounded-3xl p-6">
              <h2 className="text-xl font-bold text-white mb-5">Top 5 Spending Categories</h2>
              <div className="flex flex-col gap-3">
                {reportData.top5Categories?.map((cat: any, i: number) => {
                  const pct = reportData.totalSpend > 0 ? Math.round((cat.amount / reportData.totalSpend) * 100) : 0;
                  const colors = ["#E85D26", "#C4A832", "#7B6FE8", "#3BB8A0", "#E8526A"];
                  return (
                    <div key={cat.category}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{i + 1}.</span>
                          <span className="text-sm font-semibold text-white">{cat.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                          <span className="text-sm font-bold text-white">{fmtCurrency(cat.amount)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.4 + i * 0.1, duration: 0.7 }}
                          className="h-full rounded-full" style={{ background: colors[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* The Roast */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="glass-panel rounded-3xl p-8 border border-[hsl(var(--primary))]/30">
              <div className="flex items-center gap-3 mb-5">
                <Flame className="w-6 h-6 text-[hsl(var(--primary))]" />
                <h2 className="text-xl font-bold text-white">The Annual Roast</h2>
              </div>
              <p className="font-roast text-white text-lg leading-relaxed">"{reportData.roast}"</p>
            </motion.div>

            {/* Behavioral Analysis */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="glass-panel rounded-3xl p-8">
              <h2 className="text-xl font-bold text-white mb-4">Behavioral Analysis</h2>
              <p className="text-muted-foreground leading-relaxed">{reportData.behavioralAnalysis}</p>
            </motion.div>

            {/* 5-Year Warning */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
              className="glass-panel rounded-3xl p-8 border border-destructive/30 bg-destructive/5">
              <h2 className="text-xl font-bold text-white mb-2">5-Year Projection</h2>
              <p className="text-muted-foreground mb-4 text-sm">If your spending habits remain completely unchanged:</p>
              <div className="text-5xl font-amount-card text-destructive">{fmtCurrency(reportData.projection5yr)}</div>
              <p className="text-muted-foreground mt-2 text-sm">spent over the next 5 years at your current rate.</p>
            </motion.div>

            {/* Improvements */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="glass-panel rounded-3xl p-8 border border-[hsl(var(--secondary))]/30">
              <h2 className="text-xl font-bold text-white mb-5">3 Ways to Save Your Financial Life</h2>
              <div className="flex flex-col gap-4">
                {reportData.improvements?.map((tip: string, i: number) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--secondary))]/20 border border-[hsl(var(--secondary))]/30 flex items-center justify-center shrink-0 font-display font-black text-[hsl(var(--secondary))] text-sm">
                      {i + 1}
                    </div>
                    <p className="text-white leading-relaxed pt-1">{tip}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <button onClick={handleGenerate} disabled={reportMutation.isPending} className="text-center text-sm text-muted-foreground hover:text-white transition-colors mt-2">
              Regenerate report
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
