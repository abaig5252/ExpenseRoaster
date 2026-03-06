import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Flame, Activity, DollarSign, RefreshCw, Calendar, Loader2 } from "lucide-react";
import { useExpenses, useExpenseSummary, useMonthlyRoast } from "@/hooks/use-expenses";
import { useCurrency } from "@/hooks/use-currency";
import { ExpenseCard } from "@/components/ExpenseCard";
import { UploadModal } from "@/components/UploadModal";
import type { ExpenseResponse } from "@shared/routes";

function expenseMonth(exp: ExpenseResponse): string {
  const d = exp.date ? new Date(exp.date) : new Date();
  return d.toISOString().slice(0, 7);
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

export default function Dashboard() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const { formatAmount } = useCurrency();

  const { data: expenses, isLoading: expensesLoading, error: expensesError } = useExpenses();
  const { data: summary, isLoading: summaryLoading } = useExpenseSummary();

  const receiptExpenses = useMemo(
    () => (expenses ?? []).filter(e => e.source === "receipt"),
    [expenses]
  );

  const availableMonths = useMemo(() => {
    const months = new Set(receiptExpenses.map(expenseMonth));
    return [...months].sort().reverse();
  }, [receiptExpenses]);

  // Auto-select: current month if it has receipts, else most recent month with receipts
  useEffect(() => {
    if (availableMonths.length === 0) return;
    if (selectedMonth !== null && availableMonths.includes(selectedMonth)) return;
    const cur = new Date().toISOString().slice(0, 7);
    setSelectedMonth(availableMonths.includes(cur) ? cur : availableMonths[0]);
  }, [availableMonths.join(",")]);

  const filteredExpenses = useMemo(
    () => selectedMonth ? receiptExpenses.filter(e => expenseMonth(e) === selectedMonth) : receiptExpenses,
    [receiptExpenses, selectedMonth]
  );

  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const { data: monthlyRoastData, isLoading: roastLoading } = useMonthlyRoast(
    filteredExpenses.length > 0 ? selectedMonth : null,
    "receipt"
  );

  const formattedTotal = summary
    ? formatAmount(summary.monthlyTotal)
    : formatAmount(0);

  return (
    <div className="min-h-screen pb-24 relative">
      <div className="bg-noise" />

      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-[hsl(var(--primary))] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      {summary?.recentRoasts && summary.recentRoasts.length > 0 && (
        <div className="w-full bg-[hsl(var(--primary))]/20 border-b border-[hsl(var(--primary))]/30 overflow-hidden py-3 relative z-10 backdrop-blur-md">
          <div className="flex w-[200%] animate-marquee whitespace-nowrap">
            <div className="flex gap-12 items-center px-6">
              {summary.recentRoasts.map((roast, i) => (
                <span key={i} className="text-sm font-medium text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[hsl(var(--accent))]" />
                  "{roast}"
                </span>
              ))}
            </div>
            <div className="flex gap-12 items-center px-6">
              {summary.recentRoasts.map((roast, i) => (
                <span key={`dup-${i}`} className="text-sm font-medium text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[hsl(var(--accent))]" />
                  "{roast}"
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 relative z-10">

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel mb-6 border-[hsl(var(--secondary))]/30">
              <Activity className="w-4 h-4 text-[hsl(var(--secondary))]" />
              <span className="text-sm font-semibold tracking-wide text-[hsl(var(--secondary))] uppercase">
                Monthly Damage Report
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl font-amount-hero text-foreground leading-none flex items-center gap-2">
              {summaryLoading ? (
                <span className="animate-pulse bg-white/10 rounded-2xl w-64 h-24 block"></span>
              ) : (
                formattedTotal
              )}
            </h1>
            <p className="text-xl text-muted-foreground mt-4 font-medium">
              spent on things you probably didn't need.
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onClick={() => setIsUploadOpen(true)}
            className="group relative px-8 py-5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] rounded-3xl font-display font-bold text-xl text-white shadow-2xl shadow-[hsl(var(--primary))]/30 hover:shadow-[hsl(var(--primary))]/50 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <Plus className="w-6 h-6 relative z-10" />
            <span className="relative z-10">Upload Receipt</span>
          </motion.button>
        </header>

        {/* Receipts Grid with month filter */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-muted-foreground" />
              <h2 className="text-2xl font-bold text-foreground">Receipt Wall</h2>
              {!expensesLoading && selectedMonth && (
                <span className="text-sm text-muted-foreground font-medium">
                  — {filteredExpenses.length} receipt{filteredExpenses.length !== 1 ? "s" : ""},{" "}
                  {formatAmount(filteredTotal)}
                </span>
              )}
            </div>

            {availableMonths.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                {availableMonths.map(ym => (
                  <button
                    key={ym}
                    data-testid={`month-filter-${ym}`}
                    onClick={() => setSelectedMonth(ym)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                      selectedMonth === ym
                        ? "bg-[hsl(var(--primary))] text-white shadow-lg shadow-[hsl(var(--primary))]/30"
                        : "glass-panel text-muted-foreground hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {fmtMonth(ym)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Monthly verdict roast panel */}
          {selectedMonth && (filteredExpenses.length > 0 || roastLoading) && (
            <motion.div
              key={selectedMonth}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-8 glass-panel rounded-2xl p-5 border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))] mb-1">
                    {fmtMonth(selectedMonth)} Verdict
                  </p>
                  {roastLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating your monthly roast…
                    </div>
                  ) : monthlyRoastData?.roast ? (
                    <p className="text-sm text-white/90 leading-relaxed italic">
                      "{monthlyRoastData.roast}"
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}

          {expensesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-panel rounded-3xl p-6 h-64 animate-pulse">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl mb-4" />
                  <div className="w-1/2 h-8 bg-white/10 rounded-lg mb-2" />
                  <div className="w-1/3 h-4 bg-white/10 rounded-lg mb-8" />
                  <div className="w-full h-16 bg-white/10 rounded-xl mt-auto" />
                </div>
              ))}
            </div>
          ) : expensesError ? (
            <div className="glass-panel border-destructive/30 rounded-3xl p-12 text-center flex flex-col items-center">
              <RefreshCw className="w-12 h-12 text-destructive mb-4" />
              <h3 className="text-2xl font-bold text-foreground mb-2">Failed to load expenses</h3>
              <p className="text-muted-foreground max-w-md">
                Looks like our servers are as broken as your budget. Try refreshing the page.
              </p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="glass-panel border-dashed border-white/20 rounded-3xl p-16 text-center flex flex-col items-center justify-center">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Flame className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-4">
                {selectedMonth && receiptExpenses.length > 0 ? `No receipts in ${fmtMonth(selectedMonth)}` : "Too clean..."}
              </h3>
              <p className="text-xl text-muted-foreground max-w-lg mb-8">
                {selectedMonth && receiptExpenses.length > 0
                  ? "Nothing uploaded for this month yet. Pick another month or add a new receipt."
                  : "You haven't uploaded any receipts yet. Are you actually saving money or just hiding your shame?"}
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-6 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Upload Receipt
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExpenses.map((expense, i) => (
                <ExpenseCard key={expense.id} expense={expense} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />
    </div>
  );
}
