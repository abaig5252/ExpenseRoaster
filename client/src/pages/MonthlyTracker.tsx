import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, TrendingDown, Flame, Lightbulb,
  DollarSign, AlertTriangle, Zap, Check, X,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMonthlySeries, useExpenseSummary, useExpenses, useFinancialAdvice, type AdviceBreakdown } from "@/hooks/use-expenses";
import { AppNav } from "@/components/AppNav";
import { Skeleton } from "@/components/ui/skeleton";
import { parseReceiptDate } from "@/lib/dates";

function fmtMonth(ym: string) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function makeFmt(currencyCode: string) {
  const code = currencyCode || "USD";
  return (cents: number) =>
    (cents / 100).toLocaleString(undefined, { style: "currency", currency: code });
}

const CustomTooltip = ({ active, payload, label, currencyCode }: any) => {
  const fmt = makeFmt(currencyCode || "USD");
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl px-4 py-3 border border-white/10 text-sm">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="text-[hsl(var(--primary))]">{fmt(payload[0].value)}</p>
      {payload[0].payload.count != null && (
        <p className="text-muted-foreground">{payload[0].payload.count} transactions</p>
      )}
    </div>
  );
};

function CategoryAdviceCard({ item, currencyCode }: { item: AdviceBreakdown; currencyCode: string }) {
  const fmtCurrency = makeFmt(currencyCode);
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
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
      {item.roast && (
        <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--roast-bg)', border: '1px solid var(--roast-border)' }}>
          <Flame className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} />
          <p className="font-roast text-sm text-white/70 leading-snug">{item.roast}</p>
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <Lightbulb className="w-3.5 h-3.5 text-[hsl(var(--accent))] shrink-0 mt-0.5" />
        <p className="text-sm text-white/80 leading-relaxed">{item.insight}</p>
      </div>
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

const CATEGORY_COLORS = ["#E85D26", "#C4A832", "#7B6FE8", "#3BB8A0", "#E8526A", "#5BA85E", "#8A9099"];

type SourceFilter = "all" | "receipt" | "bank_statement";

const SOURCE_TABS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "receipt", label: "Receipts" },
  { value: "bank_statement", label: "Bank Statement" },
];

export default function MonthlyTracker() {
  const { isLoading: seriesLoading } = useMonthlySeries();
  const { data: summary, isLoading: summaryLoading } = useExpenseSummary();
  const { data: expenses } = useExpenses();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const { data: advice, isLoading: adviceLoading } = useFinancialAdvice({
    month: selectedMonth,
    year: selectedYear,
    categories: Array.from(selectedCats),
    source: sourceFilter,
  });

  function toggleCat(cat: string) {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function toggleMonth(month: string) {
    setSelectedMonth(prev => prev === month ? null : month);
  }

  // ── Derived data ──────────────────────────────────────────────────
  const allExpenses = useMemo(() => {
    const all = expenses ?? [];
    if (sourceFilter === "receipt") return all.filter(e => e.source === "receipt");
    if (sourceFilter === "bank_statement") return all.filter(e => e.source === "bank_statement" || e.source === "manual");
    return all;
  }, [expenses, sourceFilter]);

  // Derive display currency from the most recent bank statement expense
  const bankCurrency = useMemo(() => {
    const sorted = allExpenses.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return (sorted[0] as any)?.currency || "USD";
  }, [allExpenses]);
  const fmtCurrency = makeFmt(bankCurrency);

  const currentYM = new Date().toISOString().slice(0, 7);

  // Years that have expense data
  const availableYears = useMemo(() => {
    const years = new Set(allExpenses.map(e => {
      const d = parseReceiptDate(e.date);
      return String(d.getFullYear());
    }));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [allExpenses]);

  // Months (YYYY-MM) that have data within the selected year, sorted ascending
  const availableMonthsForYear = useMemo(() => {
    if (!selectedYear) return [];
    const months = new Set(
      allExpenses
        .filter(e => String(parseReceiptDate(e.date).getFullYear()) === selectedYear)
        .map(e => parseReceiptDate(e.date).toISOString().slice(0, 7))
    );
    return Array.from(months).sort();
  }, [allExpenses, selectedYear]);

  // Expenses filtered by selected month → selected year → last 12 months
  const monthFilteredExpenses = useMemo(() => {
    if (selectedMonth) {
      return allExpenses.filter(e => {
        const d = parseReceiptDate(e.date);
        return d.toISOString().slice(0, 7) === selectedMonth;
      });
    }
    if (selectedYear) {
      return allExpenses.filter(e => {
        const d = parseReceiptDate(e.date);
        return String(d.getFullYear()) === selectedYear;
      });
    }
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 11);
    cutoff.setDate(1);
    const cutoffYM = cutoff.toISOString().slice(0, 7);
    return allExpenses.filter(e => {
      const d = parseReceiptDate(e.date);
      return d.toISOString().slice(0, 7) >= cutoffYM;
    });
  }, [allExpenses, selectedMonth, selectedYear]);

  // Expenses filtered by BOTH month and categories (for transactions + stats)
  const filteredExpenses = useMemo(
    () => selectedCats.size === 0 ? monthFilteredExpenses : monthFilteredExpenses.filter(e => selectedCats.has(e.category)),
    [monthFilteredExpenses, selectedCats]
  );

  // Display total for the stats card
  const displayMonthTotal = useMemo(() => {
    if (selectedMonth || selectedYear) return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    if (selectedCats.size > 0) {
      return allExpenses
        .filter(e => {
          const d = parseReceiptDate(e.date);
          return d.toISOString().slice(0, 7) === currentYM && selectedCats.has(e.category);
        })
        .reduce((sum, e) => sum + e.amount, 0);
    }
    return summary?.monthlyTotal ?? 0;
  }, [filteredExpenses, selectedMonth, selectedYear, selectedCats, allExpenses, currentYM, summary]);

  // Category totals: from month-filtered expenses (so clicking a bar shows that month's breakdown)
  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    monthFilteredExpenses.forEach(e => { acc[e.category] = (acc[e.category] || 0) + e.amount; });
    return acc;
  }, [monthFilteredExpenses]);

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  // Chart: always computed from bank_statement allExpenses for consistency.
  // When a year is selected → Jan–Dec slots for that year.
  // Otherwise → last 12 months of bank statement data.
  const chartData = useMemo(() => {
    const src = selectedCats.size > 0 ? allExpenses.filter(e => selectedCats.has(e.category)) : allExpenses;
    const byMonth: Record<string, { total: number; count: number }> = {};
    src.forEach(e => {
      const d = parseReceiptDate(e.date);
      const ym = d.toISOString().slice(0, 7);
      if (!byMonth[ym]) byMonth[ym] = { total: 0, count: 0 };
      byMonth[ym].total += e.amount;
      byMonth[ym].count++;
    });
    if (selectedYear) {
      const now = new Date();
      const yearNum = parseInt(selectedYear);
      const endMonth = yearNum === now.getFullYear() ? now.getMonth() + 1 : 12;
      return Array.from({ length: endMonth }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        const ym = `${selectedYear}-${m}`;
        return { month: ym, label: fmtMonth(ym), total: byMonth[ym]?.total ?? 0, count: byMonth[ym]?.count ?? 0 };
      });
    }
    // Last 12 months (or all available months if fewer), sorted ascending
    const months = Object.keys(byMonth).sort().slice(-12);
    return months.map(ym => ({ month: ym, label: fmtMonth(ym), total: byMonth[ym].total, count: byMonth[ym].count }));
  }, [allExpenses, selectedYear, selectedCats]);

  // Advice breakdown — backend already filters by month/year/category so use directly
  const filteredBreakdown = useMemo(() => advice?.breakdown ?? [], [advice]);

  // Recent transactions from filteredExpenses (sorted newest first)
  const recentTransactions = useMemo(() => {
    return filteredExpenses
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [filteredExpenses]);

  const maxBar = Math.max(...(chartData.map(d => d.total) || [1]), 1);

  // Month over month comparison — use bank_statement chartData (all months, no year filter)
  const lastTwo = chartData.slice(-2);
  const [prevMonth, currentMonth] = lastTwo;
  const monthDiff = currentMonth && prevMonth ? currentMonth.total - prevMonth.total : null;
  const monthDiffPct = prevMonth?.total ? Math.round((monthDiff! / prevMonth.total) * 100) : null;
  const improved = monthDiff !== null && monthDiff < 0;

  const isFiltered = selectedCats.size > 0 || selectedMonth !== null || selectedYear !== null;

  function selectedMonthLabel() {
    if (!selectedMonth) return "";
    return new Date(selectedMonth + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function statMonthLabel() {
    if (selectedMonth) {
      const short = new Date(selectedMonth + "-02").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return selectedCats.size > 0 ? `${short} — Filtered` : short;
    }
    if (selectedYear) {
      return selectedCats.size > 0 ? `${selectedYear} — Filtered` : `${selectedYear} Total`;
    }
    return selectedCats.size > 0 ? "Filtered (This Month)" : "This Month";
  }

  function clearAllFilters() {
    setSelectedCats(new Set());
    setSelectedMonth(null);
    setSelectedYear(null);
  }

  function changeSource(src: SourceFilter) {
    setSourceFilter(src);
    setSelectedCats(new Set());
    setSelectedMonth(null);
    setSelectedYear(null);
  }

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

        {/* ── Source toggle ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex items-center gap-2 mb-8 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] w-fit">
          {SOURCE_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => changeSource(tab.value)}
              data-testid={`source-tab-${tab.value}`}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                sourceFilter === tab.value
                  ? "bg-[hsl(var(--primary))] text-black shadow-[0_0_12px_hsl(var(--primary)/0.35)]"
                  : "text-muted-foreground hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Active filter banner */}
        {isFiltered && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 mb-6 px-4 py-3 rounded-2xl"
            style={{ background: "rgba(124,255,77,0.07)", border: "1px solid rgba(124,255,77,0.2)" }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))]">Filtered by:</span>
              {selectedYear && !selectedMonth && (
                <button
                  onClick={() => setSelectedYear(null)}
                  className="flex items-center gap-1 text-xs font-semibold bg-purple-500/15 border border-purple-400/30 text-purple-300 px-2.5 py-1 rounded-full hover:bg-purple-500/25 transition-colors"
                >
                  📆 {selectedYear}
                  <X className="w-3 h-3" />
                </button>
              )}
              {selectedMonth && (
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="flex items-center gap-1 text-xs font-semibold bg-[hsl(var(--accent))]/15 border border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))] px-2.5 py-1 rounded-full hover:bg-[hsl(var(--accent))]/25 transition-colors"
                >
                  📅 {selectedMonthLabel()}
                  <X className="w-3 h-3" />
                </button>
              )}
              {Array.from(selectedCats).map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCat(cat)}
                  className="flex items-center gap-1 text-xs font-semibold bg-[hsl(var(--primary))]/15 border border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] px-2.5 py-1 rounded-full hover:bg-[hsl(var(--primary))]/25 transition-colors"
                >
                  {cat}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
            <button
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-white transition-colors whitespace-nowrap"
            >
              Clear all
            </button>
          </motion.div>
        )}

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
              {improved ? "We're shocked, honestly." : "Bold strategy. We're not going to say it's working."}
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: statMonthLabel(),
              value: summaryLoading && !isFiltered ? null : fmtCurrency(displayMonthTotal),
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
              label: selectedMonth
                ? `${new Date(selectedMonth + "-02").toLocaleDateString("en-US", { month: "short", year: "2-digit" })} Transactions`
                : selectedYear
                ? `${selectedYear} Transactions`
                : selectedCats.size > 0
                ? "Filtered Transactions"
                : "Last 12 Months",
              value: filteredExpenses.length || "—",
              icon: BarChart3,
              color: "accent",
            },
            {
              label: "Savings Potential",
              value: advice ? fmtCurrency(advice.savingsPotential) : adviceLoading ? null : "—",
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Monthly Spending{selectedCats.size > 0 ? " — Filtered" : ""}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedMonth ? `Showing ${selectedMonthLabel()} — click bar again to deselect` : "Click a bar to focus on that month"}
              </p>
            </div>
            {availableYears.length > 0 && (
              <div className="flex flex-col gap-2 items-end">
                {/* Year pills */}
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <button
                    onClick={() => { setSelectedYear(null); setSelectedMonth(null); }}
                    data-testid="year-pill-12mo"
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      !selectedYear
                        ? "bg-[hsl(var(--primary))] text-black shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                        : "bg-white/[0.06] text-muted-foreground hover:text-white hover:bg-white/[0.1] border border-white/[0.08]"
                    }`}
                  >
                    12 mo
                  </button>
                  {availableYears.map(y => (
                    <button
                      key={y}
                      onClick={() => { setSelectedYear(selectedYear === y ? null : y); setSelectedMonth(null); }}
                      data-testid={`year-pill-${y}`}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        selectedYear === y
                          ? "bg-[hsl(var(--primary))] text-black shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                          : "bg-white/[0.06] text-muted-foreground hover:text-white hover:bg-white/[0.1] border border-white/[0.08]"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                {/* Month sub-row — appears when a year is selected */}
                {selectedYear && availableMonthsForYear.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {availableMonthsForYear.map(ym => {
                      const monthShort = new Date(ym + "-02").toLocaleDateString("en-US", { month: "short" });
                      const isActive = selectedMonth === ym;
                      return (
                        <button
                          key={ym}
                          onClick={() => toggleMonth(ym)}
                          data-testid={`month-pill-${ym}`}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                            isActive
                              ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/50 shadow-[0_0_6px_hsl(var(--primary)/0.25)]"
                              : "bg-white/[0.04] text-muted-foreground border border-white/[0.08] hover:text-white hover:bg-white/[0.08]"
                          }`}
                        >
                          {monthShort}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
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
                <YAxis tickFormatter={(v) => fmtCurrency(v).replace(/\.\d+$/, "")} tick={{ fill: "hsl(260, 10%, 60%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={(props: any) => <CustomTooltip {...props} currencyCode={bankCurrency} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar
                  dataKey="total"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(data: any) => toggleMonth(data.month)}
                >
                  {chartData.map((entry, i) => {
                    const isMonthSelected = selectedMonth === entry.month;
                    const hasMonthFilter = selectedMonth !== null;
                    let fill: string;
                    if (hasMonthFilter) {
                      fill = isMonthSelected ? "hsl(var(--accent))" : "rgba(255,255,255,0.08)";
                    } else {
                      fill = entry.total === maxBar ? "hsl(var(--destructive))" : i === chartData.length - 1 ? "hsl(var(--primary))" : "hsl(var(--secondary) / 0.6)";
                    }
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="tracker-grid">
          {/* Category breakdown — clickable */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="glass-panel rounded-3xl p-6 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">Spending by Category</h2>
                {selectedMonth && (
                  <p className="text-xs text-[hsl(var(--accent))] mt-0.5 font-semibold">{selectedMonthLabel()}</p>
                )}
                {selectedYear && !selectedMonth && (
                  <p className="text-xs text-purple-300 mt-0.5 font-semibold">{selectedYear}</p>
                )}
              </div>
              {isFiltered ? (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Click to filter</span>
              )}
            </div>
            {sortedCategories.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No data yet</div>
            ) : (
              <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 -mr-2 pr-2">
                {sortedCategories.map(([cat, total], i) => {
                  const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
                  const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                  const isSelected = selectedCats.has(cat);
                  const isDimmed = isFiltered && !isSelected;

                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCat(cat)}
                      data-testid={`category-bar-${cat}`}
                      className={`w-full text-left rounded-xl px-3 py-2.5 cursor-pointer select-none transition-all duration-150 ${
                        isSelected
                          ? "bg-[hsl(var(--primary))]/8 ring-1 ring-[hsl(var(--primary))]/30"
                          : isDimmed
                          ? "opacity-35"
                          : "hover:bg-white/4"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{cat}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />}
                        </div>
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
                          style={{ background: isSelected ? "hsl(var(--primary))" : color }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Financial Advice — context-aware */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}
            className="glass-panel rounded-3xl p-6 flex flex-col min-h-0">
            {/* Fixed header */}
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))]/20 border border-[hsl(var(--accent))]/30 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-[hsl(var(--accent))]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Financial Advice</h2>
                  {advice?.timeContext && advice.timeContext !== "all-time" && (
                    <p className="text-xs text-muted-foreground mt-0.5">{advice.timeContext}</p>
                  )}
                </div>
              </div>
              {advice && advice.savingsPotential > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Save up to</p>
                  <p className="text-base font-amount-card text-[hsl(var(--secondary))]">{fmtCurrency(advice.savingsPotential)}/mo</p>
                </div>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto min-h-0 -mr-2 pr-2">
            {adviceLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-3/4 bg-white/5" />
                <Skeleton className="h-16 w-full bg-white/5 mt-1" />
                <Skeleton className="h-16 w-full bg-white/5" />
                <Skeleton className="h-16 w-full bg-white/5" />
              </div>
            ) : advice ? (
              <div className="flex flex-col gap-3">
                {advice.advice && (
                  <div className="flex items-start gap-3 bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/20 rounded-2xl px-4 py-3">
                    <Zap className="w-4 h-4 text-[hsl(var(--accent))] shrink-0 mt-0.5" />
                    <p className="text-base font-bold text-white leading-snug">{advice.advice}</p>
                  </div>
                )}

                {filteredBreakdown.length > 0 ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mt-1">
                      By Category ({filteredBreakdown.length})
                    </p>
                    {filteredBreakdown.map((item, i) => (
                      <div key={item.category}>
                        {i > 0 && <div className="border-t border-white/10 my-1" />}
                        <CategoryAdviceCard item={item} currencyCode={bankCurrency} />
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 text-center py-8">
                    <Flame className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">No expenses match this filter — try a different period or category.</p>
                  </div>
                )}

                <div className="flex items-center gap-2 px-1 mt-1">
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
            </div>{/* end scrollable body */}
          </motion.div>
        </div>

        {/* Recent transactions — filtered */}
        {recentTransactions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="glass-panel rounded-3xl p-6 mt-6">
            <h2 className="text-xl font-bold text-white mb-5">
              {isFiltered ? "Filtered Transactions" : "Recent Transactions"}
            </h2>
            <div className="flex flex-col divide-y divide-white/5">
              {recentTransactions.map((exp, i) => (
                <div key={exp.id} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white truncate">{exp.description}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: `${CATEGORY_COLORS[sortedCategories.findIndex(([c]) => c === exp.category) % CATEGORY_COLORS.length]}22`, color: CATEGORY_COLORS[sortedCategories.findIndex(([c]) => c === exp.category) % CATEGORY_COLORS.length] }}
                      >
                        {exp.category}
                      </span>
                    </div>
                    {exp.roast && (
                      <p className="text-xs text-muted-foreground italic line-clamp-2">"{exp.roast}"</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white shrink-0">{makeFmt((exp as any).currency || bankCurrency)(exp.amount)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
