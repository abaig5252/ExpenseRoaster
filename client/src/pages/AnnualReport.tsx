import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Flame, TrendingUp, TrendingDown, Calendar, Target, Download, AlertTriangle, Loader2, Lock, Sparkles, Lightbulb, BarChart2, Users, Zap } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { useMe, useAnnualReport } from "@/hooks/use-subscription";
import { useCheckout, useStripeProducts } from "@/hooks/use-subscription";
import { Link } from "wouter";
import { formatAmount } from "@/hooks/use-currency";

function fmtMonth(ym: string) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtAmt(cents: number, currency: string) {
  return formatAmount(cents, currency);
}

export default function AnnualReport() {
  const { data: me } = useMe();
  const { data: products } = useStripeProducts();
  const checkoutMutation = useCheckout();
  const reportMutation = useAnnualReport();
  const reportRef = useRef<HTMLDivElement>(null);
  const [reportData, setReportData] = useState<any>(null);
  const reportCurrency = reportData?.currency || "USD";
  const fmt = (cents: number) => fmtAmt(cents, reportCurrency);

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
              Get a full year of financial analysis with brutal honesty, behavioral insights, and a 5-year projection. $29.99 per report — premium subscribers generate for free.
            </p>
            <div className="glass-panel rounded-3xl p-8 mb-6 text-left">
              <div className="text-5xl font-amount-card text-white mb-1">$29.99</div>
              <div className="text-muted-foreground mb-6">Per report — generate a fresh one any time</div>
              <ul className="flex flex-col gap-3 mb-8">
                {[
                  "Brutal full-year roast",
                  "Your personal spending personality type",
                  "Deep behavioral analysis",
                  "Top 5 categories with spending bars",
                  "Best & worst month comparison",
                  "Per-merchant insights & tips",
                  "5 savings opportunities with real alternatives",
                  "Monthly spending trend",
                  "5-year projection if you don't change",
                  "Fun facts from your transaction history",
                  "Downloadable PDF",
                ].map(f => (
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
              This analyzes every single transaction you've uploaded — merchants, patterns, habits — and generates a comprehensive financial deep-dive. Give it 20–30 seconds.
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
              {reportMutation.isPending ? "Digging through every receipt…" : "Generate My Annual Report"}
            </button>
          </motion.div>
        ) : (
          <div ref={reportRef} className="flex flex-col gap-6">

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Spent", value: fmt(reportData.totalSpend), icon: TrendingUp, color: "primary" },
                { label: "Monthly Avg", value: fmt(reportData.avgMonthlySpend), icon: Calendar, color: "secondary" },
                { label: "5-Year Projection", value: fmt(reportData.projection5yr), icon: Target, color: "destructive" },
                { label: "Transactions", value: reportData.transactionCount?.toLocaleString() ?? "—", icon: BarChart2, color: "accent" },
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

            {/* Best vs worst month */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-4">
              <div className="glass-panel rounded-2xl p-5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-green-400">Best Month</span>
                </div>
                <div className="text-lg font-bold text-white">{reportData.bestMonth?.month ? fmtMonth(reportData.bestMonth.month) : "—"}</div>
                <div className="text-sm text-muted-foreground">{fmt(reportData.bestMonth?.amount || 0)}</div>
              </div>
              <div className="glass-panel rounded-2xl p-5 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-destructive" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-destructive">Worst Month</span>
                </div>
                <div className="text-lg font-bold text-white">{reportData.worstMonth?.month ? fmtMonth(reportData.worstMonth.month) : "—"}</div>
                <div className="text-sm text-muted-foreground">{fmt(reportData.worstMonth?.amount || 0)}</div>
              </div>
            </motion.div>

            {/* Spending Personality */}
            {reportData.spendingPersonality && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                className="glass-panel rounded-3xl p-8 border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-[hsl(var(--accent))]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--accent))]">Your Spending Personality</span>
                </div>
                <div className="text-3xl font-bold text-white mb-3">{reportData.spendingPersonality.title}</div>
                <p className="text-muted-foreground leading-relaxed">{reportData.spendingPersonality.description}</p>
              </motion.div>
            )}

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
                          <span className="text-sm font-bold text-white">{fmt(cat.amount)}</span>
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

            {/* Fun Fact */}
            {reportData.funFact && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                className="glass-panel rounded-2xl px-6 py-5 flex items-start gap-4 border border-yellow-500/20 bg-yellow-500/5">
                <Sparkles className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-white leading-relaxed text-sm">{reportData.funFact}</p>
              </motion.div>
            )}

            {/* Behavioral Analysis */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="glass-panel rounded-3xl p-8">
              <h2 className="text-xl font-bold text-white mb-4">Behavioral Analysis</h2>
              <p className="text-muted-foreground leading-relaxed">{reportData.behavioralAnalysis}</p>
            </motion.div>

            {/* Monthly Trend */}
            {reportData.monthlyTrend && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.52 }}
                className="glass-panel rounded-2xl px-6 py-5 flex items-start gap-4">
                <TrendingUp className="w-5 h-5 text-[hsl(var(--secondary))] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--secondary))] mb-1">Spending Trend</div>
                  <p className="text-white text-sm leading-relaxed">{reportData.monthlyTrend}</p>
                </div>
              </motion.div>
            )}

            {/* Merchant Insights */}
            {reportData.merchantInsights?.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                className="glass-panel rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="w-6 h-6 text-[hsl(var(--accent))]" />
                  <h2 className="text-xl font-bold text-white">Merchant Insights</h2>
                </div>
                <div className="flex flex-col gap-4">
                  {reportData.merchantInsights.map((m: any, i: number) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))]/15 border border-[hsl(var(--accent))]/25 flex items-center justify-center shrink-0 font-bold text-[hsl(var(--accent))] text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4 mb-1 flex-wrap">
                          <span className="font-bold text-white text-sm">{m.merchant}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{fmt(m.totalSpent)}</span>
                            <span>·</span>
                            <span>{m.visits} visit{m.visits !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{m.insight}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Savings Opportunities */}
            {reportData.savingsOpportunities?.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="glass-panel rounded-3xl p-8 border border-green-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <Lightbulb className="w-6 h-6 text-green-400" />
                  <h2 className="text-xl font-bold text-white">Savings Opportunities</h2>
                  <span className="text-xs text-muted-foreground ml-auto">Real alternatives with estimated annual savings</span>
                </div>
                <div className="flex flex-col gap-4">
                  {reportData.savingsOpportunities.map((opp: any, i: number) => (
                    <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{opp.category}</span>
                          <div className="text-sm font-bold text-white mt-0.5">Currently spending {fmt(opp.currentAnnualSpend)}/yr</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-muted-foreground">Potential saving</div>
                          <div className="text-lg font-bold text-green-400">{fmt(opp.potentialAnnualSaving)}/yr</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-medium">Try instead: {opp.alternative}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{opp.tip}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 5-Year Warning */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
              className="glass-panel rounded-3xl p-8 border border-destructive/30 bg-destructive/5">
              <h2 className="text-xl font-bold text-white mb-2">5-Year Projection</h2>
              <p className="text-muted-foreground mb-4 text-sm">If your spending habits remain completely unchanged:</p>
              <div className="text-5xl font-amount-card text-destructive">{fmt(reportData.projection5yr)}</div>
              <p className="text-muted-foreground mt-2 text-sm">spent over the next 5 years at your current rate.</p>
            </motion.div>

            {/* Improvements */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
              className="glass-panel rounded-3xl p-8 border border-[hsl(var(--secondary))]/30">
              <h2 className="text-xl font-bold text-white mb-5">5 Ways to Save Your Financial Life</h2>
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
              {reportMutation.isPending ? <span className="flex items-center gap-2 justify-center"><Loader2 className="w-3 h-3 animate-spin" /> Regenerating…</span> : "Regenerate report"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
