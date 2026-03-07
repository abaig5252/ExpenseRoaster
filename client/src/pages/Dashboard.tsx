import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Flame, Activity, Camera, RefreshCw, ChevronDown, Loader2, Trash2, X } from "lucide-react";
import { useExpenses, useExpenseSummary, useMonthlyRoast, useDeleteExpense, useBulkDeleteExpenses } from "@/hooks/use-expenses";
import { useCurrency } from "@/hooks/use-currency";
import { ExpenseCard } from "@/components/ExpenseCard";
import { UploadModal } from "@/components/UploadModal";
import type { ExpenseResponse } from "@shared/routes";
import { parseReceiptDate } from "@/lib/dates";
import { useToast } from "@/hooks/use-toast";

function expenseMonth(exp: ExpenseResponse): string {
  const d = exp.date ? parseReceiptDate(exp.date) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

export default function Dashboard() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const { data: expenses, isLoading: expensesLoading, error: expensesError } = useExpenses();
  const { data: summary } = useExpenseSummary();
  const deleteSingle = useDeleteExpense();
  const bulkDeleteMutation = useBulkDeleteExpenses();

  const receiptExpenses = useMemo(
    () => (expenses ?? []).filter(e => e.source === "receipt"),
    [expenses]
  );

  const availableMonths = useMemo(() => {
    const months = new Set(receiptExpenses.map(expenseMonth));
    return [...months].sort().reverse();
  }, [receiptExpenses]);

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

  const displayTotal = expensesLoading
    ? null
    : filteredExpenses.length > 0
      ? formatAmount(filteredTotal)
      : formatAmount(0);

  const displaySubtitle = selectedMonth && filteredExpenses.length > 0
    ? `spent on receipts in ${fmtMonth(selectedMonth)}.`
    : "upload receipts to track your spending.";

  // ─── Select Mode State ───────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const allSelected = filteredExpenses.length > 0 && filteredExpenses.every(e => selectedIds.has(e.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExpenses.map(e => e.id)));
    }
  }, [allSelected, filteredExpenses]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setShowBulkConfirm(false);
    setExitingIds(new Set(ids));
    setTimeout(async () => {
      try {
        await bulkDeleteMutation.mutateAsync(ids);
        toast({
          description: `${ids.length} receipt${ids.length !== 1 ? "s" : ""} deleted`,
        });
      } catch {
        toast({ description: "Failed to delete receipts", variant: "destructive" });
      }
      setExitingIds(new Set());
      setSelectMode(false);
      setSelectedIds(new Set());
    }, 320);
  }, [selectedIds, bulkDeleteMutation, toast]);

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
                Receipt Damage Report
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl font-amount-hero text-foreground leading-none flex items-center gap-2">
              {expensesLoading ? (
                <span className="animate-pulse bg-white/10 rounded-2xl w-64 h-24 block" />
              ) : (
                displayTotal
              )}
            </h1>
            <p className="text-xl text-muted-foreground mt-4 font-medium">
              {displaySubtitle}
            </p>
          </motion.div>

          {!selectMode && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              onClick={() => setIsUploadOpen(true)}
              data-testid="button-upload-receipt"
              className="group relative px-8 py-5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] rounded-3xl font-display font-bold text-xl text-white shadow-2xl shadow-[hsl(var(--primary))]/30 hover:shadow-[hsl(var(--primary))]/50 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <Plus className="w-6 h-6 relative z-10" />
              <span className="relative z-10">Upload Receipt</span>
            </motion.button>
          )}
        </header>

        {/* Receipt Wall */}
        <div>
          {/* Section header row */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <Camera className="w-5 h-5 text-muted-foreground shrink-0" />
            <h2 className="text-2xl font-bold text-foreground">Receipt Wall</h2>
            {!expensesLoading && filteredExpenses.length > 0 && (
              <span
                data-testid="badge-receipt-count"
                className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] text-xs font-bold flex items-center justify-center"
              >
                {filteredExpenses.length}
              </span>
            )}

            {/* Select mode controls */}
            {selectMode ? (
              <div className="ml-auto flex items-center gap-3">
                <button
                  data-testid="button-select-all"
                  onClick={toggleSelectAll}
                  className="text-sm font-semibold text-[hsl(var(--primary))] hover:opacity-80 transition-opacity"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                <button
                  data-testid="button-cancel-select"
                  onClick={exitSelectMode}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-3">
                {/* Select Mode button — shown when there are receipts */}
                {filteredExpenses.length > 0 && (
                  <button
                    data-testid="button-enter-select-mode"
                    onClick={enterSelectMode}
                    className="text-sm font-semibold text-white/50 hover:text-white/90 transition-colors"
                  >
                    Select Mode
                  </button>
                )}
                {/* Month dropdown */}
                {availableMonths.length > 0 && (
                  <div className="relative">
                    <select
                      data-testid="select-month-filter"
                      value={selectedMonth ?? ""}
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm font-semibold bg-white/[0.08] border border-white/15 text-white cursor-pointer hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
                    >
                      {availableMonths.map(ym => (
                        <option key={ym} value={ym} className="bg-[#1a1a1a] text-white">
                          {fmtMonth(ym)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Month filter pills — hidden in select mode */}
          {!selectMode && availableMonths.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-6 no-scrollbar">
              {availableMonths.map(ym => (
                <button
                  key={ym}
                  data-testid={`month-pill-${ym}`}
                  onClick={() => setSelectedMonth(ym)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                    selectedMonth === ym
                      ? "text-white shadow-lg shadow-[#00E676]/30"
                      : "border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  style={selectedMonth === ym ? { backgroundColor: "#00E676" } : { backgroundColor: "#2a2a2a" }}
                >
                  {fmtMonth(ym)}
                </button>
              ))}
            </div>
          )}

          {/* Monthly verdict roast panel — hidden in select mode */}
          {!selectMode && selectedMonth && (filteredExpenses.length > 0 || roastLoading) && (
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

          {/* Receipt cards */}
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
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  index={i}
                  onDelete={() => deleteSingle.mutate(expense.id)}
                  isDeleting={deleteSingle.isPending}
                  isSelectMode={selectMode}
                  isSelected={selectedIds.has(expense.id)}
                  onSelect={() => toggleSelect(expense.id)}
                  isExiting={exitingIds.has(expense.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />

      {/* Sticky bottom bar — shown in select mode */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3"
            style={{ background: "linear-gradient(to top, rgba(10,10,10,0.98) 60%, transparent)" }}
          >
            <div className="max-w-lg mx-auto">
              <button
                data-testid="button-bulk-delete"
                onClick={() => selectedIds.size > 0 && setShowBulkConfirm(true)}
                disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
                className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200"
                style={{
                  background: selectedIds.size === 0 ? "rgba(255,82,82,0.12)" : "#FF5252",
                  color: selectedIds.size === 0 ? "rgba(255,82,82,0.4)" : "#FFFFFF",
                  cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
                }}
              >
                <Trash2 className="w-5 h-5" />
                {selectedIds.size === 0
                  ? "Select receipts to delete"
                  : `Delete (${selectedIds.size} selected)`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk delete confirmation dialog */}
      <AnimatePresence>
        {showBulkConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowBulkConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)" }}
              data-testid="dialog-bulk-delete"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "rgba(255,82,82,0.12)", border: "1px solid rgba(255,82,82,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Trash2 style={{ width: 22, height: 22, color: "#FF5252" }} />
                </div>
                <div>
                  <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: 17, color: "#FFFFFF", margin: "0 0 6px" }}>
                    Delete {selectedIds.size} receipt{selectedIds.size !== 1 ? "s" : ""}?
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#8A9099", margin: 0, lineHeight: 1.5 }}>
                    This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  data-testid="button-bulk-delete-cancel"
                  onClick={() => setShowBulkConfirm(false)}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                    color: "#8A9099", fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600, fontSize: 14, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  data-testid="button-bulk-delete-confirm"
                  onClick={handleBulkDelete}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 14,
                    border: "none", background: "#FF5252",
                    color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
