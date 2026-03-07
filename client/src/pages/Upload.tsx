import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Plus, Receipt, RefreshCw, Lock, Camera, Loader2, Trash2, X } from "lucide-react";
import { useExpenses, useExpenseSummary, useDeleteExpense, useBulkDeleteExpenses, useMonthlyRoast } from "@/hooks/use-expenses";
import { ReceiptCollageCard } from "@/components/ReceiptCollageCard";
import { UploadModal } from "@/components/UploadModal";
import { AppNav } from "@/components/AppNav";
import { RoastCard } from "@/components/RoastCard";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-subscription";
import { useCurrency } from "@/hooks/use-currency";
import { parseReceiptDate } from "@/lib/dates";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { ExpenseResponse } from "@shared/routes";

function expenseMonth(exp: ExpenseResponse): string {
  const d = exp.date ? parseReceiptDate(exp.date) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

export default function Upload() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [ephemeralRoast, setEphemeralRoast] = useState<any>(null);
  const [showRoastCard, setShowRoastCard] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // ─── Select Mode ─────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());

  const { user } = useAuth();
  const { data: me } = useMe();
  const { data: expenses, isLoading, error } = useExpenses();
  const { data: summary } = useExpenseSummary();
  const deleteMutation = useDeleteExpense();
  const bulkDeleteMutation = useBulkDeleteExpenses();
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const isFree = !me || me.tier === "free";
  const uploadsUsed = me?.monthlyUploadCount || 0;
  const uploadsRemaining = Math.max(0, 1 - uploadsUsed);
  const firstName = user?.firstName || user?.email?.split("@")[0] || "friend";

  // Only receipt-type expenses
  const receiptExpenses = useMemo(
    () => (expenses ?? []).filter(e => e.source === "receipt"),
    [expenses]
  );

  // Unique months sorted most recent first
  const availableMonths = useMemo(() => {
    const months = new Set(receiptExpenses.map(expenseMonth));
    return [...months].sort().reverse();
  }, [receiptExpenses]);

  // Auto-select most recent month when data loads
  useEffect(() => {
    if (availableMonths.length === 0) return;
    if (selectedMonth !== null && availableMonths.includes(selectedMonth)) return;
    setSelectedMonth(availableMonths[0]);
  }, [availableMonths.join(",")]);

  // Filter receipts by selected month
  const filteredReceipts = useMemo(
    () => selectedMonth ? receiptExpenses.filter(e => expenseMonth(e) === selectedMonth) : receiptExpenses,
    [receiptExpenses, selectedMonth]
  );

  // Filtered total (in cents)
  const filteredTotal = filteredReceipts.reduce((sum, e) => sum + e.amount, 0);

  // Monthly verdict roast
  const { data: monthlyRoastData, isLoading: roastLoading } = useMonthlyRoast(
    !isFree && filteredReceipts.length > 0 ? selectedMonth : null,
    "receipt"
  );

  // ─── Select Mode Callbacks ────────────────────────────────────────
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

  const allSelected = filteredReceipts.length > 0 && filteredReceipts.every(e => selectedIds.has(e.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReceipts.map(e => e.id)));
    }
  }, [allSelected, filteredReceipts]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setShowBulkConfirm(false);
    setExitingIds(new Set(ids));
    setTimeout(async () => {
      try {
        await bulkDeleteMutation.mutateAsync(ids);
        toast({ description: `${ids.length} receipt${ids.length !== 1 ? "s" : ""} deleted` });
      } catch {
        toast({ description: "Failed to delete receipts", variant: "destructive" });
      }
      setExitingIds(new Set());
      setSelectMode(false);
      setSelectedIds(new Set());
    }, 320);
  }, [selectedIds, bulkDeleteMutation, toast]);

  const handleUploadSuccess = (data: any) => {
    if (data.ephemeral) {
      setEphemeralRoast(data);
      setShowRoastCard(true);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-noise" />
      <AppNav />

      {/* Marquee roast banner */}
      {summary?.recentRoasts && summary.recentRoasts.length > 0 && (
        <div className="w-full bg-[hsl(var(--primary))]/15 border-b border-[hsl(var(--primary))]/20 overflow-hidden py-2.5 z-30 relative">
          <div className="flex w-[200%] animate-marquee whitespace-nowrap">
            {[...summary.recentRoasts, ...summary.recentRoasts].map((roast, i) => (
              <span key={i} className="text-sm font-medium text-white flex items-center gap-3 mr-12">
                <Flame className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
                "{roast}"
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest mb-3">
              Hey {firstName},{" "}
              {isFree ? "here's your free roast zone" : "here's your receipt wall"}
            </p>
            {!isFree && (
              <h1 className="text-6xl md:text-8xl font-amount-hero text-white leading-none">
                {isLoading ? (
                  <span className="animate-pulse bg-white/10 rounded-2xl w-48 h-20 block" />
                ) : formatAmount(filteredTotal)}
              </h1>
            )}
            {isFree && (
              <h1 className="text-5xl font-bold text-white leading-none mb-3">
                Roast My Receipt
              </h1>
            )}
            <p className="text-muted-foreground mt-3 text-lg">
              {isFree
                ? `${uploadsRemaining}/1 free upload remaining this month.`
                : selectedMonth && filteredReceipts.length > 0
                  ? `spent on receipts in ${fmtMonth(selectedMonth)}.`
                  : `spent this month on things you definitely needed.`}
            </p>
          </motion.div>

          {!selectMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex flex-col gap-3 items-end"
            >
              <button
                onClick={() => setIsUploadOpen(true)}
                disabled={isFree && uploadsRemaining === 0}
                data-testid="button-upload-receipt"
                className="group relative px-8 py-5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] rounded-2xl font-display font-bold text-xl text-white btn-glow transition-all duration-300 flex items-center gap-3 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-6 h-6" />
                <span>Upload Receipt</span>
              </button>
              {isFree && uploadsRemaining === 0 && (
                <Link href="/pricing">
                  <span className="text-xs text-[hsl(var(--primary))] hover:underline cursor-pointer">
                    Upgrade for unlimited uploads →
                  </span>
                </Link>
              )}
            </motion.div>
          )}
        </header>

        {/* Free tier upgrade nudge */}
        {isFree && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-2xl p-5 mb-8 border border-[hsl(var(--primary))]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">You're on the Free plan</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upgrade to Premium for unlimited uploads, spending history, and more.
                </p>
              </div>
            </div>
            <Link href="/pricing">
              <button
                data-testid="button-upgrade-nudge"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white text-sm font-bold whitespace-nowrap hover:opacity-90 transition-all"
              >
                Upgrade — $9.99/mo
              </button>
            </Link>
          </motion.div>
        )}

        {/* Ephemeral roast card (free tier) */}
        <AnimatePresence>
          {showRoastCard && ephemeralRoast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8"
            >
              <RoastCard
                expense={ephemeralRoast}
                watermark={isFree}
                onClose={() => setShowRoastCard(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Receipt Wall (premium only) */}
        {!isFree && (
          <div>
            {/* Section header row */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Camera className="w-5 h-5 text-muted-foreground shrink-0" />
              <h2 className="text-2xl font-bold text-white">Receipt Wall</h2>
              {!isLoading && filteredReceipts.length > 0 && (
                <span
                  data-testid="badge-receipt-count"
                  className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] text-xs font-bold flex items-center justify-center"
                >
                  {filteredReceipts.length}
                </span>
              )}

              {/* Select mode controls — right side */}
              <div className="ml-auto flex items-center gap-3">
                {selectMode ? (
                  <>
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
                  </>
                ) : receiptExpenses.length > 0 ? (
                  <button
                    data-testid="button-enter-select-mode"
                    onClick={enterSelectMode}
                    className="text-sm font-semibold text-white/50 hover:text-white/90 transition-colors"
                  >
                    Select Mode
                  </button>
                ) : null}
              </div>
            </div>

            {/* Month filter pills — always shown when there is at least 1 receipt */}
            {receiptExpenses.length > 0 && (
              <div
                data-testid="month-pills-row"
                style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 24, scrollbarWidth: "none" }}
              >
                {availableMonths.map(ym => (
                  <button
                    key={ym}
                    data-testid={`month-pill-${ym}`}
                    onClick={() => setSelectedMonth(ym)}
                    style={
                      selectedMonth === ym
                        ? { flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9999, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", backgroundColor: "#00E676", color: "#000000", boxShadow: "0 4px 16px rgba(0,230,118,0.35)", border: "none", cursor: "pointer" }
                        : { flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9999, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", backgroundColor: "#2a2a2a", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }
                    }
                  >
                    <span>📅</span>
                    {fmtMonth(ym)}
                  </button>
                ))}
              </div>
            )}

            {/* Monthly verdict roast panel */}
            {!selectMode && selectedMonth && (filteredReceipts.length > 0 || roastLoading) && (
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
            {isLoading ? (
              <div className="columns-2 md:columns-3 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="glass-panel rounded-3xl h-56 animate-pulse"
                    style={{ marginBottom: 16, breakInside: "avoid" }}
                  />
                ))}
              </div>
            ) : error ? (
              <div className="glass-panel rounded-3xl p-12 text-center">
                <RefreshCw className="w-10 h-10 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Failed to load</h3>
                <p className="text-muted-foreground">Servers down. Like your savings.</p>
              </div>
            ) : receiptExpenses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel border-dashed border-white/10 rounded-3xl p-16 text-center flex flex-col items-center"
              >
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5">
                  <Receipt className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-3xl font-bold mb-3">No receipts yet</h3>
                <p className="text-lg text-muted-foreground max-w-md mb-8">
                  Upload a receipt photo and watch your poor decisions get immortalised on the wall.
                </p>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  data-testid="button-upload-first"
                  className="px-8 py-4 rounded-2xl font-display font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white btn-glow"
                >
                  Add First Receipt
                </button>
              </motion.div>
            ) : filteredReceipts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel border-dashed border-white/10 rounded-3xl p-12 text-center flex flex-col items-center"
              >
                <p className="text-lg text-muted-foreground">
                  No receipts in {selectedMonth ? fmtMonth(selectedMonth) : "this month"}.
                </p>
              </motion.div>
            ) : (
              <div className="columns-2 md:columns-3 lg:columns-4" style={{ gap: 16 }}>
                {filteredReceipts.map((expense, i) => (
                  <ReceiptCollageCard
                    key={expense.id}
                    expense={expense}
                    index={i}
                    onDelete={() => deleteMutation.mutate(expense.id)}
                    isDeleting={deleteMutation.isPending && deleteMutation.variables === expense.id}
                    isSelectMode={selectMode}
                    isSelected={selectedIds.has(expense.id)}
                    onSelect={() => toggleSelect(expense.id)}
                    isExiting={exitingIds.has(expense.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        isFree={isFree}
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
