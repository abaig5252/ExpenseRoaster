import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Plus, Receipt, RefreshCw, Lock, Camera, Loader2, Trash2, X, ChevronDown } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useExpenses, useExpenseSummary, useDeleteExpense, useBulkDeleteExpenses, useMonthlyRoast, useRegenerateVerdict, useUpdateExpense } from "@/hooks/use-expenses";
import { ReceiptCollageCard } from "@/components/ReceiptCollageCard";
import { UploadModal } from "@/components/UploadModal";
import { AppNav } from "@/components/AppNav";
import { RoastCard } from "@/components/RoastCard";
import { VerdictText } from "@/components/VerdictText";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-subscription";
import { CURRENCIES } from "@/hooks/use-currency";
import { parseReceiptDate } from "@/lib/dates";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
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
  const updateMutation = useUpdateExpense();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reRoastingSet, setReRoastingSet] = useState<Set<number>>(new Set());

  // ─── Edit Receipt ─────────────────────────────────────────────────
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");

  const openEditDialog = useCallback((expense: ExpenseResponse) => {
    setEditingExpense(expense);
    setEditDesc(expense.description);
    setEditAmount((expense.amount / 100).toFixed(2));
    setEditCategory(expense.category);
    const d = expense.date instanceof Date ? expense.date : new Date(expense.date as unknown as string);
    setEditDate(d.toISOString().slice(0, 10));
    setEditCurrency((expense as any).currency || "USD");
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditingExpense(null);
    updateMutation.reset();
  }, [updateMutation]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingExpense) return;
    const amountCents = Math.round(parseFloat(editAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    const categoryChanged = editCategory !== editingExpense.category;
    const expenseId = editingExpense.id;
    updateMutation.mutate(
      { id: expenseId, description: editDesc.trim(), amount: amountCents, category: editCategory, date: editDate, currency: editCurrency },
      {
        onSuccess: () => {
          setEditingExpense(null);
          if (categoryChanged) {
            setReRoastingSet(prev => new Set(prev).add(expenseId));
            apiRequest("POST", `/api/expenses/${expenseId}/re-roast`, {})
              .then(() => qc.invalidateQueries({ queryKey: ["/api/expenses"] }))
              .finally(() => setReRoastingSet(prev => { const next = new Set(prev); next.delete(expenseId); return next; }));
          }
        },
      }
    );
  }, [editingExpense, editDesc, editAmount, editCategory, editDate, editCurrency, updateMutation, qc]);

  const isFree = !me || me.tier === "free";
  const uploadsUsed = me?.monthlyUploadCount || 0;
  const uploadsRemaining = Math.max(0, 3 - uploadsUsed);
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

  // Most common currency among the filtered receipts
  const baseCurrency = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredReceipts.forEach(e => {
      const c = (e as any).currency || "USD";
      counts[c] = (counts[c] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || "USD";
  }, [filteredReceipts]);

  // Display currency — defaults to baseCurrency, user can override to convert
  const [displayCurrency, setDisplayCurrency] = useState<string>(baseCurrency);
  useEffect(() => { setDisplayCurrency(baseCurrency); }, [baseCurrency]);

  const needsConversion = displayCurrency !== baseCurrency;

  const { data: rateData, isLoading: rateLoading } = useQuery<{ rate: number }>({
    queryKey: [`/api/exchange-rate?from=${baseCurrency}&to=${displayCurrency}`],
    enabled: needsConversion && !!baseCurrency,
    staleTime: 60 * 60 * 1000,
  });

  const convertedTotal = useMemo(() => {
    if (!needsConversion) return filteredTotal;
    if (!rateData?.rate) return null;
    return Math.round(filteredTotal * rateData.rate);
  }, [filteredTotal, needsConversion, rateData]);

  function fmtInCurrency(cents: number, code: string) {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency: code || "USD" });
  }

  // Monthly verdict roast — always query when a month is selected
  const { data: monthlyRoastData, isLoading: roastLoading } = useMonthlyRoast(
    selectedMonth,
    "receipt"
  );
  const regenerateMutation = useRegenerateVerdict();
  const hasVerdict = !!monthlyRoastData?.roast;
  const manualRegenUsed = monthlyRoastData?.manualRegenUsed ?? false;

  // Average receipt amount across ALL receipts (not just filtered month)
  // Used to compute relative flame severity on each card
  const avgReceiptAmountCents = useMemo(() => {
    if (receiptExpenses.length === 0) return 0;
    return Math.round(receiptExpenses.reduce((sum, e) => sum + e.amount, 0) / receiptExpenses.length);
  }, [receiptExpenses]);

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
              <div>
                <h1 className="text-6xl md:text-8xl font-amount-hero text-white leading-none">
                  {isLoading ? (
                    <span className="animate-pulse bg-white/10 rounded-2xl w-48 h-20 block" />
                  ) : rateLoading ? (
                    <span className="animate-pulse bg-white/10 rounded-2xl w-36 h-16 md:w-48 md:h-20 block" />
                  ) : needsConversion && convertedTotal !== null
                    ? `≈ ${fmtInCurrency(convertedTotal, displayCurrency)}`
                    : fmtInCurrency(filteredTotal, baseCurrency)}
                </h1>
                {/* Currency selector */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="relative">
                    <select
                      value={displayCurrency}
                      onChange={e => setDisplayCurrency(e.target.value)}
                      data-testid="select-display-currency"
                      className="appearance-none bg-white/5 border border-white/10 text-white/70 text-xs font-bold rounded-xl pl-3 pr-7 py-1.5 cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:border-[hsl(var(--primary))]/50"
                    >
                      {CURRENCIES.map(({ code }) => (
                        <option key={code} value={code} className="bg-[#121212] text-white">{code}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/50 pointer-events-none" />
                  </div>
                  {needsConversion && rateData && (
                    <span className="text-xs text-muted-foreground">converted from {baseCurrency}</span>
                  )}
                  {needsConversion && !rateData && !rateLoading && (
                    <span className="text-xs text-red-400/70">rate unavailable</span>
                  )}
                </div>
              </div>
            )}
            {isFree && (
              <h1 className="text-5xl font-bold text-white leading-none mb-3">
                Roast My Receipt
              </h1>
            )}
            <p className="text-muted-foreground mt-3 text-lg">
              {isFree
                ? `${uploadsRemaining}/3 free uploads remaining this month.`
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
            {!selectMode && selectedMonth && filteredReceipts.length > 0 && (
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
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))]">
                          {fmtMonth(selectedMonth)} Verdict
                        </p>
                        {monthlyRoastData?.locked && (
                          <Lock className="w-3 h-3 text-[hsl(var(--primary))]/50" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Premium: Regenerate button (1 per month) */}
                        {hasVerdict && !isFree && !manualRegenUsed && (
                          <button
                            data-testid="button-regenerate-verdict"
                            onClick={() => regenerateMutation.mutate({ month: selectedMonth!, source: "receipt" })}
                            disabled={regenerateMutation.isPending}
                            title="Regenerate verdict (1 per month)"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[hsl(var(--primary))]/70 hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 transition-all duration-200 disabled:opacity-50"
                          >
                            {regenerateMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            <span>Regenerate</span>
                          </button>
                        )}
                        {/* Premium: grayed out after using the one manual regen */}
                        {hasVerdict && !isFree && manualRegenUsed && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground/40 cursor-not-allowed" title="Regeneration used for this month">
                            <RefreshCw className="w-3 h-3" />
                            <span>Regenerate</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    {regenerateMutation.isPending && !hasVerdict ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Generating your {fmtMonth(selectedMonth)} verdict…</span>
                      </div>
                    ) : hasVerdict ? (
                      <div className="flex flex-col gap-3">
                        <VerdictText roast={monthlyRoastData!.roast!} />
                        {/* Free users: show upgrade prompt below the locked verdict */}
                        {isFree && (
                          <p className="text-xs text-[hsl(var(--primary))]/60 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Upgrade to Premium to regenerate your verdict.
                          </p>
                        )}
                        <ShareButton
                          text={`🔥 ${fmtMonth(selectedMonth)} Verdict:\n\n"${monthlyRoastData!.roast}"\n\n— Expense Roaster`}
                          label="Share My Roast 🔥"
                          variant="full"
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 transition-all duration-200"
                        />
                      </div>
                    ) : (
                      /* No verdict yet */
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Uncle Sergio has been watching your spending. Your monthly verdict awaits.
                        </p>
                        {isFree ? (
                          <p className="text-xs text-[hsl(var(--primary))]/70 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Monthly verdicts require Premium.
                          </p>
                        ) : (
                          <button
                            data-testid="button-get-verdict"
                            onClick={() => regenerateMutation.mutate({ month: selectedMonth!, source: "receipt" })}
                            disabled={regenerateMutation.isPending}
                            className="self-start flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-[hsl(var(--primary))]/20 hover:bg-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/30 transition-all duration-200 disabled:opacity-50"
                          >
                            <Flame className="w-4 h-4" />
                            Get Your Verdict
                          </button>
                        )}
                      </div>
                    )}
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
                    avgAmountCents={avgReceiptAmountCents}
                    onDelete={() => deleteMutation.mutate(expense.id)}
                    onEdit={() => openEditDialog(expense)}
                    isDeleting={deleteMutation.isPending && deleteMutation.variables === expense.id}
                    isSelectMode={selectMode}
                    isSelected={selectedIds.has(expense.id)}
                    onSelect={() => toggleSelect(expense.id)}
                    isExiting={exitingIds.has(expense.id)}
                    reRoasting={reRoastingSet.has(expense.id)}
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

      {/* ── Edit Receipt Dialog ── */}
      <AnimatePresence>
        {editingExpense && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={closeEditDialog}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="glass-panel w-full max-w-md rounded-[2rem] overflow-hidden flex flex-col border border-white/10 shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[hsl(var(--primary))]/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-[hsl(var(--primary))]" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Edit Receipt</h2>
                </div>
                <button onClick={closeEditDialog} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-5">
                {/* Merchant */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Merchant</label>
                  <input
                    data-testid="input-edit-merchant"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base font-semibold focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/30"
                    placeholder="Merchant name"
                  />
                </div>

                {/* Amount + Currency row */}
                <div className="flex gap-3">
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Amount</label>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-[hsl(var(--primary))]/50 focus-within:ring-1 focus-within:ring-[hsl(var(--primary))]/30">
                      <span className="text-[hsl(var(--primary))] font-bold text-lg select-none">
                        {editCurrency === "GBP" ? "£" : editCurrency === "EUR" ? "€" : editCurrency === "JPY" ? "¥" : editCurrency === "INR" ? "₹" : "$"}
                      </span>
                      <input
                        data-testid="input-edit-amount"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        type="number"
                        step="0.01"
                        min="0"
                        className="flex-1 bg-transparent text-white text-xl font-bold focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-28">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Currency</label>
                    <select
                      data-testid="select-edit-currency"
                      value={editCurrency}
                      onChange={e => setEditCurrency(e.target.value)}
                      className="h-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-semibold focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/30 cursor-pointer"
                      style={{ appearance: "none", WebkitAppearance: "none" }}
                    >
                      {CURRENCIES.map(({ code }) => (
                        <option key={code} value={code} style={{ background: "#1A1A2E" }}>{code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</label>
                  <input
                    data-testid="input-edit-date"
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base font-semibold focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/30"
                    style={{ colorScheme: "dark" }}
                  />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {["Food & Drink","Groceries","Shopping","Transport","Travel","Entertainment","Health & Fitness","Subscriptions","Donations","Other"].map(cat => {
                      const active = editCategory === cat;
                      const colors: Record<string,string> = {
                        "Food & Drink":"#E85D26","Groceries":"#78A856","Shopping":"#C4A832",
                        "Transport":"#3BB8A0","Travel":"#3B8EB8","Entertainment":"#E8526A",
                        "Health & Fitness":"#5BA85E","Subscriptions":"#7B6FE8","Donations":"#5BA8A8","Other":"#4A5060",
                      };
                      const col = colors[cat] ?? "#4A5060";
                      return (
                        <button
                          key={cat}
                          onClick={() => setEditCategory(cat)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150"
                          style={{
                            background: active ? col : "rgba(255,255,255,0.05)",
                            borderColor: active ? col : "rgba(255,255,255,0.12)",
                            color: active ? "#fff" : "rgba(255,255,255,0.55)",
                          }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={closeEditDialog}
                    data-testid="button-edit-cancel"
                    className="flex-1 py-3 rounded-2xl font-semibold text-muted-foreground border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending || !editDesc.trim() || !editAmount}
                    data-testid="button-edit-save"
                    className="flex-2 py-3 px-6 rounded-2xl font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))", flex: 2 }}
                  >
                    {updateMutation.isPending ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
