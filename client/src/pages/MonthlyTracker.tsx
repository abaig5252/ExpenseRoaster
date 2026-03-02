import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Flame, Lightbulb, DollarSign, AlertTriangle, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMonthlySeries, useExpenseSummary, useExpenses, useFinancialAdvice, type AdviceBreakdown } from "@/hooks/use-expenses";
import { AppNav } from "@/components/AppNav";
import { Skeleton } from "@/components/ui/skeleton";
import type { Expense } from "@shared/schema";

function fmtCurrency(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtMonth(ym: string) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl px-4 py-3 border border-white/10 text-sm">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="text-[hsl(var(--primary))]">{fmtCurrency(payload[0].value)}</p>
      <p className="text-muted-foreground">{payload[0].payload.count} transactions</p>
    </div>
  );
};

function CategoryAdviceCard({ item }: { item: AdviceBreakdown }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      {/* Header: category + savings */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/30">
          {item.category}
        </span>
        {item.potentialSaving > 0 && (
          <span className="text-xs font-bold text-[hsl(var(--secondary))] bg-[hsl(var(--secondary))]/10 border border-[hsl(var(--secondary))]/20 px-2.5 py-1 rounded-full">
            save ~{fmtCurrency(item.potentialSaving)}/mo
          </span>
        )}
      </div>

      {/* Roast */}
      {item.roast && (
        <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--roast-bg)', border: '1px solid var(--roast-border)' }}>
          <Flame className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} />
          <p className="font-roast text-sm text-white/70 leading-snug">{item.roast}</p>
        </div>
      )}

      {/* Advice */}
      <div className="flex items-start gap-2.5">
        <Lightbulb className="w-3.5 h-3.5 text-[hsl(var(--accent))] shrink-0 mt-0.5" />
        <p className="text-sm text-white/80 leading-relaxed">{item.insight}</p>
      </div>

      {/* Alternatives */}
      {item.alternatives?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {item.alternatives.map((alt, i) => (
            <span key={i} className="text-xs text-white/70 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              {alt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Deterministic pseudo-random from date string (for demo when no expense data)
function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}

// Iso weekday 0=Mon … 6=Sun
function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function SpendingHeatmap({ expenses }: { expenses: Expense[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Start grid on the Monday on or before 1st of this month
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - isoWeekday(firstOfMonth));

  // Build exactly 28 days
  const days: Date[] = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const isInCurrentMonth = (d: Date) => d.getFullYear() === year && d.getMonth() === month;
  const isFuture = (d: Date) => d > now;
  const isFilled = (d: Date) => isInCurrentMonth(d) && !isFuture(d);

  // Aggregate expenses by local date string
  const hasAnyExpenses = expenses.length > 0;
  const dailyTotals: Record<string, number> = {};
  expenses.forEach(e => {
    // Parse as local date to avoid UTC shift
    const raw = new Date(e.date);
    const key = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
    dailyTotals[key] = (dailyTotals[key] || 0) + e.amount;
  });

  const maxDaily = Math.max(...Object.values(dailyTotals), 1);

  function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getOpacity(d: Date): number {
    if (!isFilled(d)) return 0.05;
    const key = dayKey(d);
    if (!hasAnyExpenses) return seededRandom(key) * 0.95 + 0.05;
    const spend = dailyTotals[key] || 0;
    if (spend === 0) return 0.05;
    const ratio = spend / maxDaily;
    if (ratio <= 0.25) return 0.2;
    if (ratio <= 0.5) return 0.45;
    if (ratio <= 0.75) return 0.75;
    return 1.0;
  }

  function isPeak(d: Date): boolean {
    if (!isFilled(d)) return false;
    const key = dayKey(d);
    if (!hasAnyExpenses) return seededRandom(key) > 0.88;
    const spend = dailyTotals[key] || 0;
    return spend > 0 && spend / maxDaily > 0.75;
  }

  const dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="glass-panel rounded-3xl p-6 mt-6"
    >
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize: 13,
        textTransform: 'uppercase',
        color: 'var(--text-2, hsl(220 10% 65%))',
        letterSpacing: '0.05em',
        margin: '0 0 14px',
      }}>
        Spending Heat This Month
      </p>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {/* Day headers */}
        {dayHeaders.map((h, i) => (
          <div key={i} style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 9,
            color: 'var(--text-3, hsl(220 10% 45%))',
            textAlign: 'center',
            paddingBottom: 2,
          }}>
            {h}
          </div>
        ))}

        {/* Day cells */}
        {days.map((d, i) => {
          const filled = isFilled(d);
          const opacity = getOpacity(d);
          const peak = isPeak(d);
          const spend = dailyTotals[dayKey(d)];
          const label = filled
            ? `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${spend ? fmtCurrency(spend) : 'No spend'}`
            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <div
              key={i}
              title={label}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 5,
                background: `rgba(232, 93, 38, ${opacity})`,
                border: !filled ? '1px dashed rgba(255,255,255,0.08)' : undefined,
                boxShadow: peak ? '0 0 12px rgba(232,93,38,0.6)' : undefined,
                cursor: filled && spend ? 'default' : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'var(--text-3, hsl(220 10% 45%))' }}>
          less damage
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0.1, 0.3, 0.5, 0.75, 1.0].map((op, i) => (
            <div key={i} style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: `rgba(232, 93, 38, ${op})`,
            }} />
          ))}
        </div>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'var(--text-3, hsl(220 10% 45%))' }}>
          catastrophic
        </span>
      </div>
    </motion.div>
  );
}

export default function MonthlyTracker() {
  const { data: series, isLoading: seriesLoading } = useMonthlySeries();
  const { data: summary, isLoading: summaryLoading } = useExpenseSummary();
  const { data: expenses } = useExpenses();
  const { data: advice, isLoading: adviceLoading } = useFinancialAdvice();

  const chartData = series?.map(s => ({ ...s, label: fmtMonth(s.month) })) ?? [];

  // Category breakdown from all expenses
  const categoryTotals: Record<string, number> = {};
  expenses?.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  const maxBar = Math.max(...(chartData.map(d => d.total) || [1]));

  // Month over month comparison
  const lastTwo = chartData.slice(-2);
  const [prevMonth, currentMonth] = lastTwo;
  const monthDiff = currentMonth && prevMonth ? currentMonth.total - prevMonth.total : null;
  const monthDiffPct = prevMonth?.total ? Math.round((monthDiff! / prevMonth.total) * 100) : null;
  const improved = monthDiff !== null && monthDiff < 0;

  const categoryColors = ["#E85D26", "#C4A832", "#7B6FE8", "#3BB8A0", "#E8526A", "#5BA85E", "#8A9099"];

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-noise" />
      <AppNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--accent))]/20 border border-[hsl(var(--accent))]/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[hsl(var(--accent))]" />
            </div>
            <h1 className="text-4xl font-bold text-white">Monthly Tracker</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Your spending history, a breakdown of where it goes, and advice you won't want to hear.
          </p>
        </motion.div>

        {/* Trend banner */}
        {monthDiffPct !== null && (
          <div
            className="flex items-center gap-3 mb-6"
            style={{
              background: improved ? "rgba(74,155,111,0.1)" : "rgba(192,57,43,0.1)",
              border: `1px solid ${improved ? "rgba(74,155,111,0.2)" : "rgba(192,57,43,0.2)"}`,
              borderRadius: 14,
              padding: "12px 16px",
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{improved ? "📉" : "📈"}</span>
            <p style={{ margin: 0, fontSize: 14, color: improved ? "#6BCF9A" : "#E07B6B", lineHeight: 1.5 }}>
              <strong>
                {improved ? "Down" : "Up"} {Math.abs(monthDiffPct)}% from{" "}
                {new Date(prevMonth.month + "-02").toLocaleString("en-US", { month: "long" })}.
              </strong>{" "}
              {improved
                ? "We're shocked, honestly."
                : "Bold strategy. We're not going to say it's working."}
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "This Month",
              value: summaryLoading ? null : fmtCurrency(summary?.monthlyTotal ?? 0),
              icon: DollarSign,
              color: "primary",
            },
            {
              label: "vs Last Month",
              value: monthDiff !== null ? `${improved ? "" : "+"}${fmtCurrency(Math.abs(monthDiff))}` : "—",
              sub: monthDiffPct !== null ? `${monthDiffPct > 0 ? "+" : ""}${monthDiffPct}%` : "",
              icon: improved ? TrendingDown : TrendingUp,
              color: improved ? "secondary" : "destructive",
            },
            {
              label: "Transactions",
              value: expenses?.length ?? 0,
              icon: BarChart3,
              color: "accent",
            },
            {
              label: "Savings Potential",
              value: advice ? fmtCurrency(advice.savingsPotential) : "—",
              icon: Flame,
              color: "primary",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-panel rounded-2xl p-5"
            >
              <div className={`w-8 h-8 rounded-xl mb-3 flex items-center justify-center bg-[hsl(var(--${stat.color}))]/20 border border-[hsl(var(--${stat.color}))]/30`}>
                <stat.icon className={`w-4 h-4 text-[hsl(var(--${stat.color}))]`} />
              </div>
              <div className={`text-2xl font-amount-card mb-0.5 ${stat.color === "destructive" && !improved ? "text-destructive" : "text-white"}`}>
                {stat.value ?? <Skeleton className="h-7 w-20 bg-white/10" />}
              </div>
              {stat.sub && <div className="text-xs text-muted-foreground">{stat.sub}</div>}
              <div className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-panel rounded-3xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Monthly Spending (Last 12 Months)</h2>
          {seriesLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-muted-foreground text-sm">Loading your financial history...</div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <BarChart3 className="w-10 h-10 text-muted-foreground" />
              <p className="text-muted-foreground">No spending data yet. Upload some receipts!</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barSize={28} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "hsl(260, 10%, 60%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
                  tick={{ fill: "hsl(260, 10%, 60%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.total === maxBar
                        ? "hsl(var(--destructive))"
                        : i === chartData.length - 1
                        ? "hsl(var(--primary))"
                        : "hsl(var(--secondary) / 0.6)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="tracker-grid">
          {/* Category breakdown */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="glass-panel rounded-3xl p-6">
            <h2 className="text-xl font-bold text-white mb-5">Spending by Category</h2>
            {sortedCategories.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No data yet</div>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedCategories.map(([cat, total], i) => {
                  const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
                  const color = categoryColors[i % categoryColors.length];
                  return (
                    <div key={cat}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-white">{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                          <span className="text-sm font-bold text-white">{fmtCurrency(total)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.4 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Financial Advice */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}
            className="glass-panel rounded-3xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))]/20 border border-[hsl(var(--accent))]/30 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-[hsl(var(--accent))]" />
                </div>
                <h2 className="text-xl font-bold text-white">Financial Advice</h2>
              </div>
              {advice && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Save up to</p>
                  <p className="text-base font-amount-card text-[hsl(var(--secondary))]">{fmtCurrency(advice.savingsPotential)}/mo</p>
                </div>
              )}
            </div>

            {adviceLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-3/4 bg-white/5" />
                <Skeleton className="h-16 w-full bg-white/5 mt-1" />
                <Skeleton className="h-16 w-full bg-white/5" />
              </div>
            ) : advice ? (
              <div className="flex flex-col gap-3">
                {/* Punchy headline */}
                <div className="flex items-start gap-3 bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/20 rounded-2xl px-4 py-3">
                  <Zap className="w-4 h-4 text-[hsl(var(--accent))] shrink-0 mt-0.5" />
                  <p className="text-base font-bold text-white leading-snug">{advice.advice}</p>
                </div>

                {/* Category cards */}
                {advice.breakdown && advice.breakdown.length > 0 && (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mt-1">By Category</p>
                    {advice.breakdown.map((item, i) => (
                      <div key={item.category}>
                        {i > 0 && <div className="border-t border-white/10 my-1" />}
                        <CategoryAdviceCard item={item} />
                      </div>
                    ))}
                  </>
                )}

                <div className="flex items-center gap-2 px-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">For guidance only — consult a financial advisor for major decisions.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-8">
                <Flame className="w-10 h-10 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Upload expenses to get personalized financial advice.</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Spending Heatmap */}
        <SpendingHeatmap expenses={expenses ?? []} />

      </main>
    </div>
  );
}
