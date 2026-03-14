import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText, Flame, TrendingUp, TrendingDown, Calendar, Target, Download, AlertTriangle, Loader2, Lock, Sparkles, Lightbulb, BarChart2, Users, Zap, RefreshCw } from "lucide-react";
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

function fmtDate(dt: string | Date) {
  return new Date(dt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function AnnualReport() {
  const { data: me, isLoading: meLoading } = useMe();
  const { data: products } = useStripeProducts();
  const checkoutMutation = useCheckout();
  const reportMutation = useAnnualReport();
  const reportRef = useRef<HTMLDivElement>(null);
  const [freshReport, setFreshReport] = useState<any>(null);

  // Load previously saved report from DB
  const { data: savedReport, isLoading: savedLoading } = useQuery<any>({
    queryKey: ["/api/expenses/annual-report/latest"],
    retry: false,
  });

  // Freshly generated report takes priority over saved; fall back to saved
  const reportData = freshReport || savedReport || null;
  const reportCurrency = reportData?.currency || "USD";
  const fmt = (cents: number) => fmtAmt(cents, reportCurrency);

  const canAccess = me?.hasAnnualReport;
  const annualPrice = products?.find((p: any) => p.price_metadata?.plan === "annual_report" || p.metadata?.plan === "annual_report");

  const handleGenerate = () => {
    reportMutation.mutate(undefined, {
      onSuccess: (data) => setFreshReport(data),
    });
  };

  const handleDownload = () => {
    if (!reportData) return;
    const currency = reportData.currency || "USD";
    const f = (cents: number) => (cents / 100).toLocaleString(undefined, { style: "currency", currency });
    const fMonth = (ym: string) => {
      const [y, m] = ym.split("-");
      return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    };
    const catColors = ["#E85D26","#C4A832","#7B6FE8","#3BB8A0","#E8526A"];

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${reportData.reportYear ?? new Date().getFullYear()} Year-to-Date Roast Report — Expense Roaster</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#111;padding:48px 56px;max-width:860px;margin:0 auto;font-size:14px;line-height:1.6}
  h1{font-size:28px;font-weight:800;margin-bottom:4px}
  h2{font-size:17px;font-weight:700;margin-bottom:12px;color:#111}
  .sub{color:#666;font-size:13px;margin-bottom:32px}
  .logo{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:8px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .stat{background:#f5f5f5;border-radius:12px;padding:16px}
  .stat-val{font-size:18px;font-weight:800;color:#111;margin-bottom:2px}
  .stat-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#888;font-weight:600}
  .months{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
  .month-best{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px}
  .month-worst{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px}
  .month-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
  .month-best .month-lbl{color:#16a34a}.month-worst .month-lbl{color:#dc2626}
  .month-name{font-size:15px;font-weight:700}.month-val{font-size:13px;color:#555;margin-top:2px}
  .card{background:#f8f8f8;border-radius:14px;padding:20px;margin-bottom:16px;border:1px solid #eee}
  .card-accent{background:#fffbeb;border-color:#fde68a}
  .card-roast{background:#fff7f4;border-color:#fdddd5}
  .card-savings{background:#f0fdf4;border-color:#bbf7d0}
  .tag{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;padding:3px 8px;border-radius:20px;margin-bottom:8px}
  .tag-primary{background:#fff4e6;color:#b45309}
  .tag-accent{background:#eff6ff;color:#1d4ed8}
  .tag-green{background:#f0fdf4;color:#15803d}
  .roast-text{font-style:italic;font-size:15px;line-height:1.7;color:#222}
  .cat-row{margin-bottom:10px}
  .cat-label{display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;font-weight:600}
  .cat-bar-bg{height:8px;background:#e5e5e5;border-radius:4px;overflow:hidden}
  .cat-bar{height:8px;border-radius:4px}
  .merchant-row{display:flex;gap:12px;align-items:flex-start;padding:12px;background:#fff;border:1px solid #eee;border-radius:10px;margin-bottom:8px}
  .merchant-num{width:28px;height:28px;border-radius:8px;background:#eff6ff;color:#1d4ed8;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
  .merchant-name{font-weight:700;font-size:13px}
  .merchant-meta{font-size:11px;color:#888;margin-top:2px}
  .merchant-insight{font-size:12px;color:#555;margin-top:4px}
  .saving-row{background:#fff;border:1px solid #d1fae5;border-radius:10px;padding:14px;margin-bottom:8px}
  .saving-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
  .saving-cat{font-size:11px;font-weight:700;text-transform:uppercase;color:#888;letter-spacing:.6px}
  .saving-spent{font-size:13px;font-weight:700;margin-top:2px}
  .saving-amount{font-size:16px;font-weight:800;color:#16a34a}
  .saving-alt{display:inline-block;font-size:11px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;border-radius:20px;padding:2px 8px;margin-bottom:4px;font-weight:600}
  .saving-tip{font-size:12px;color:#555}
  .improvement{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f0f0f0}
  .improvement:last-child{border-bottom:none}
  .imp-num{width:22px;height:22px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px}
  .personality-title{font-size:22px;font-weight:800;margin-bottom:8px}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;display:flex;justify-content:space-between}
  @media print{body{padding:32px 40px}@page{margin:0.5in}}
</style></head><body>
<div class="logo">Expense Roaster</div>
<h1>${reportData.reportYear ?? new Date().getFullYear()} Year-to-Date Roast Report</h1>
<div class="sub">${reportData.ytdLabel ?? `Jan 1 – ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`} &nbsp;·&nbsp; ${reportData.transactionCount} transactions &nbsp;·&nbsp; ${currency}</div>

<div class="stats">
  <div class="stat"><div class="stat-val">${f(reportData.totalSpend)}</div><div class="stat-lbl">Total Spent</div></div>
  <div class="stat"><div class="stat-val">${f(reportData.avgMonthlySpend)}</div><div class="stat-lbl">Monthly Avg</div></div>
  <div class="stat"><div class="stat-val">${f(reportData.projection5yr)}</div><div class="stat-lbl">5-Year Projection</div></div>
  <div class="stat"><div class="stat-val">${reportData.transactionCount?.toLocaleString()}</div><div class="stat-lbl">Transactions</div></div>
</div>

<div class="months">
  <div class="month-best"><div class="month-lbl">Best Month</div><div class="month-name">${reportData.bestMonth?.month ? fMonth(reportData.bestMonth.month) : "—"}</div><div class="month-val">${f(reportData.bestMonth?.amount||0)}</div></div>
  <div class="month-worst"><div class="month-lbl">Worst Month</div><div class="month-name">${reportData.worstMonth?.month ? fMonth(reportData.worstMonth.month) : "—"}</div><div class="month-val">${f(reportData.worstMonth?.amount||0)}</div></div>
</div>

${reportData.spendingPersonality ? `
<div class="card">
  <div class="tag tag-accent">Spending Personality</div>
  <div class="personality-title">${reportData.spendingPersonality.title}</div>
  <div style="color:#444">${reportData.spendingPersonality.description}</div>
</div>` : ""}

<div class="card card-roast">
  <div class="tag tag-primary">🔥 The Annual Roast</div>
  <div class="roast-text">"${reportData.roast}"</div>
</div>

${reportData.funFact ? `<div class="card card-accent"><div class="tag tag-primary">✨ Fun Fact</div><div>${reportData.funFact}</div></div>` : ""}

<div class="card">
  <h2>Top 5 Spending Categories</h2>
  ${(reportData.top5Categories||[]).map((cat: any, i: number) => {
    const pct = reportData.totalSpend > 0 ? Math.round((cat.amount/reportData.totalSpend)*100) : 0;
    return `<div class="cat-row">
      <div class="cat-label"><span>${i+1}. ${cat.category}</span><span>${f(cat.amount)} &nbsp; ${pct}%</span></div>
      <div class="cat-bar-bg"><div class="cat-bar" style="width:${pct}%;background:${catColors[i]}"></div></div>
    </div>`;
  }).join("")}
</div>

<div class="card">
  <h2>Behavioral Analysis</h2>
  <div style="color:#444">${reportData.behavioralAnalysis}</div>
</div>

${reportData.monthlyTrend ? `<div class="card"><div class="tag tag-accent">Spending Trend</div><div>${reportData.monthlyTrend}</div></div>` : ""}

${reportData.merchantInsights?.length ? `
<div class="card">
  <h2>Merchant Insights</h2>
  ${reportData.merchantInsights.map((m: any, i: number) => `
    <div class="merchant-row">
      <div class="merchant-num">${i+1}</div>
      <div style="flex:1">
        <div class="merchant-name">${m.merchant}</div>
        <div class="merchant-meta">${f(m.totalSpent)} &nbsp;·&nbsp; ${m.visits} visit${m.visits!==1?"s":""}</div>
        <div class="merchant-insight">${m.insight}</div>
      </div>
    </div>`).join("")}
</div>` : ""}

${reportData.savingsOpportunities?.length ? `
<div class="card card-savings">
  <h2>Savings Opportunities</h2>
  ${reportData.savingsOpportunities.map((opp: any) => `
    <div class="saving-row">
      <div class="saving-head">
        <div><div class="saving-cat">${opp.category}</div><div class="saving-spent">Currently ${f(opp.currentAnnualSpend)}/yr</div></div>
        <div><div style="font-size:11px;color:#888">Potential saving</div><div class="saving-amount">${f(opp.potentialAnnualSaving)}/yr</div></div>
      </div>
      <div class="saving-alt">Try instead: ${opp.alternative}</div>
      <div class="saving-tip">${opp.tip}</div>
    </div>`).join("")}
</div>` : ""}

<div class="card" style="background:#fef2f2;border-color:#fecaca">
  <div class="tag" style="background:#fee2e2;color:#dc2626">5-Year Projection</div>
  <div style="font-size:11px;color:#888;margin-bottom:8px">Based on all uploaded data${reportData.allTimeYearsRange ? ` (${reportData.allTimeYearsRange})` : ""} — if spending habits stay unchanged</div>
  <div style="font-size:32px;font-weight:800;color:#dc2626">${f(reportData.projection5yr)}</div>
  <div style="font-size:12px;color:#555;margin-top:4px">estimated spend over the next 5 years at your historical monthly rate</div>
</div>

${reportData.improvements?.length ? `
<div class="card">
  <h2>Top Improvements</h2>
  ${reportData.improvements.map((imp: string, i: number) => `
    <div class="improvement"><div class="imp-num">${i+1}</div><div>${imp}</div></div>`).join("")}
</div>` : ""}

<div class="footer">
  <span>Expense Roaster — ${reportData.reportYear ?? new Date().getFullYear()} Year-to-Date Roast Report</span>
  <span>${new Date().toLocaleDateString()}</span>
</div>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 600);
  };

  // Loading state
  if (meLoading || savedLoading) {
    return (
      <div className="min-h-screen pb-24">
        <div className="bg-noise" />
        <AppNav />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // No saved report + no purchase → purchase screen
  if (!reportData && !canAccess) {
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
              Get a year-to-date financial analysis with brutal honesty, behavioral insights, and a full-year spending projection. $29.99 per report, every time.
            </p>
            <div className="glass-panel rounded-3xl p-8 mb-6 text-left">
              <div className="text-5xl font-amount-card text-white mb-1">$29.99</div>
              <div className="text-muted-foreground mb-6">Per report — stays saved, generate again any time</div>
              <ul className="flex flex-col gap-3 mb-8">
                {[
                  "Brutal year-to-date roast",
                  "Your personal spending personality type",
                  "Deep behavioral analysis",
                  "Top 5 categories with spending bars",
                  "Best & worst month comparison",
                  "Per-merchant insights & tips",
                  "5 savings opportunities with real alternatives",
                  "Monthly spending trend",
                  "5-year projection based on all historical data",
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

  // No saved report + has purchase → generate screen
  if (!reportData && canAccess) {
    return (
      <div className="min-h-screen pb-24">
        <div className="bg-noise" />
        <AppNav />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <h1 className="text-4xl font-bold text-white">Annual Roast Report</h1>
            <p className="text-muted-foreground mt-2 text-lg">The full year-to-date financial post-mortem. No sugarcoating.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-3xl p-16 text-center">
            <div className="w-20 h-20 rounded-full bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 flex items-center justify-center mx-auto mb-6">
              <Flame className="w-10 h-10 text-[hsl(var(--primary))]" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Ready to face the truth?</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Analyzes every transaction you've uploaded this year — merchants, patterns, habits — and projects your full-year spend. Give it 20–30 seconds.
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
              <div>
                <h1 className="text-4xl font-bold text-white">Annual Roast Report</h1>
                {reportData?.ytdLabel && (
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">{reportData.ytdLabel}</div>
                )}
              </div>
            </div>
            {reportData && (
              <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all text-sm font-semibold text-white" data-testid="button-download-report">
                <Download className="w-4 h-4" /> Download PDF
              </button>
            )}
          </div>
          <p className="text-muted-foreground mt-2 text-lg">The full year-to-date financial post-mortem. No sugarcoating.</p>
        </motion.div>

        <div ref={reportRef} className="flex flex-col gap-6">

            {/* Generate Again banner */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-2xl px-6 py-4 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">
                  {reportData?.generatedAt ? `Generated ${fmtDate(reportData.generatedAt)}` : "Your saved report"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Generate again with latest data — $29.99 per report
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {reportMutation.isError && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{(reportMutation.error as Error)?.message}
                  </span>
                )}
                {canAccess ? (
                  <button
                    onClick={handleGenerate}
                    disabled={reportMutation.isPending}
                    data-testid="button-generate-again"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(var(--primary))]/20 border border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--primary))]/30 transition-all text-sm font-semibold text-[hsl(var(--primary))]"
                  >
                    {reportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {reportMutation.isPending ? "Generating…" : "Generate Again"}
                  </button>
                ) : (
                  <button
                    onClick={() => checkoutMutation.mutate({ priceId: annualPrice?.price_id || "", mode: "payment" })}
                    disabled={checkoutMutation.isPending}
                    data-testid="button-buy-regenerate"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] hover:opacity-90 transition-all text-sm font-bold text-white"
                  >
                    {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                    Generate Annual Report — $29.99
                  </button>
                )}
              </div>
            </motion.div>

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

            {/* 5-Year Projection Warning */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
              className="glass-panel rounded-3xl p-8 border border-destructive/30 bg-destructive/5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">5-Year Projection</h2>
                  <p className="text-muted-foreground text-sm">Based on your average monthly spend across all uploaded data{reportData.allTimeYearsRange ? ` (${reportData.allTimeYearsRange})` : ""}. If nothing changes:</p>
                </div>
              </div>
              <div className="text-5xl font-amount-card text-destructive">{fmt(reportData.projection5yr)}</div>
              <p className="text-muted-foreground mt-2 text-sm">spent over the next 5 years at your historical monthly rate.</p>
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

        </div>
      </main>
    </div>
  );
}
