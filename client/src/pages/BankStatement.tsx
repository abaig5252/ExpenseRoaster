import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { parseReceiptDate } from "@/lib/dates";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Wallet, UploadCloud, Flame, Trash2, AlertCircle, Loader2, FileText, Lock, Image, Calendar, CheckCircle2, ChevronDown, MessageSquare, X, RefreshCw, Sparkles } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { useExpenses, useDeleteExpense, useBulkDeleteExpenses } from "@/hooks/use-expenses";
import { useMe, useImportCSV } from "@/hooks/use-subscription";
import { CURRENCIES } from "@/hooks/use-currency";
import { AppNav } from "@/components/AppNav";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

function formatMonthLabel(month: string) {
  const [yr, mo] = month.split("-").map(Number);
  return new Date(yr, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type PreviewResult = {
  transactions: { description: string; amount: number; date: string }[];
  detectedMonth: string;
  transactionCount: number;
  location: string | null;
};

const TONES = [
  { value: "sergio",        label: "Roasted 🔥" },
  { value: "sergio_savage", label: "Destroyed 💀" },
];

const ALL_CATEGORIES = [
  "Food & Drink", "Groceries", "Shopping", "Transport", "Travel",
  "Entertainment", "Health & Fitness", "Subscriptions", "Donations",
  "Insurance", "Professional Fees", "Internet", "Phone", "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink":    "#E85D26",
  "Groceries":       "#C4A832",
  "Shopping":        "#C4A832",
  "Transport":       "#3BB8A0",
  "Travel":          "#4A9FE8",
  "Entertainment":   "#E8526A",
  "Health & Fitness":"#5BA85E",
  "Subscriptions":   "#7B6FE8",
  "Coffee":          "#7B6FE8",
  "Donations":       "#5BA8A8",
  "Insurance":       "#5B8EC4",
  "Professional Fees":"#A07850",
  "Internet":        "#4A7BE8",
  "Phone":           "#9B5BE8",
  "Other":           "#4A5060",
};

function EditableCategoryPill({ expenseId, category, onCategoryChanged }: {
  expenseId: number;
  category: string;
  onCategoryChanged?: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(category);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const pillColor = CATEGORY_COLORS[current] || "#4A5060";

  async function selectCategory(cat: string) {
    if (cat === current) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      await apiRequest("PATCH", `/api/expenses/${expenseId}/category`, { category: cat });
      setCurrent(cat);
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Category updated", description: `Classified as ${cat} — roast updated.` });
      onCategoryChanged?.(expenseId);
    } catch {
      toast({ title: "Failed to update category", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        data-testid={`pill-category-${expenseId}`}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          background: pillColor, borderRadius: 6,
          padding: "3px 7px 3px 7px",
          fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "#FFFFFF", border: "none", cursor: saving ? "wait" : "pointer",
          opacity: saving ? 0.7 : 1, transition: "opacity 0.15s",
        }}
      >
        {saving ? "..." : current}
        <ChevronDown style={{ width: 9, height: 9, opacity: 0.8, flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
            background: "#1E1E1E", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "4px 0", minWidth: 160,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            maxHeight: 220, overflowY: "auto",
          }}
          onClick={e => e.stopPropagation()}
        >
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat}
              data-testid={`option-category-${expenseId}-${cat.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => selectCategory(cat)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "7px 12px", background: "none",
                border: "none", cursor: "pointer", textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseOut={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: CATEGORY_COLORS[cat] || "#4A5060", flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: cat === current ? 700 : 500,
                color: cat === current ? "#FFFFFF" : "#8A9099",
              }}>
                {cat}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BankStatement() {
  const [importCurrency, setImportCurrency] = useState<string>("USD");
  const [tone, setTone] = useState("sergio");
  const [importData, setImportData] = useState<{ data: string; format: "pdf" | "image"; fileName: string } | null>(null);
  const [converting, setConverting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [editMonth, setEditMonth] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [reRoastingSet, setReRoastingSet] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const leftColRef = useRef<HTMLDivElement>(null);
  const [leftColHeight, setLeftColHeight] = useState<number | null>(null);

  const handleCategoryChanged = useCallback(async (expenseId: number) => {
    setReRoastingSet(prev => new Set(prev).add(expenseId));
    try {
      await apiRequest("POST", `/api/expenses/${expenseId}/re-roast`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
    } finally {
      setReRoastingSet(prev => { const next = new Set(prev); next.delete(expenseId); return next; });
    }
  }, []);

  useEffect(() => {
    const el = leftColRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setLeftColHeight(entries[0]?.contentRect.height ?? null);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data: me } = useMe();
  const importMutation = useImportCSV();
  const deleteMutation = useDeleteExpense();
  const bulkDeleteMutation = useBulkDeleteExpenses();
  const { data: expenses } = useExpenses();
  const { toast } = useToast();

  const { data: monthsData } = useQuery<{ months: string[] }>({
    queryKey: ["/api/statement-months"],
  });
  const availableMonths = monthsData?.months ?? [];

  const activeMonth = selectedMonth ?? availableMonths[0] ?? null;

  const { data: roastData, isLoading: roastLoading } = useQuery<{ roast: string | null; isDirty?: boolean }>({
    queryKey: ["/api/statement-roast", activeMonth],
    enabled: !!activeMonth,
  });
  const statementRoast = roastData?.roast ?? null;
  const roastIsDirty = roastData?.isDirty ?? false;

  const regenerateRoastMutation = useMutation({
    mutationFn: async (month: string) => {
      const res = await fetch(`/api/statement-roast/${month}/regenerate`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? `Server error ${res.status}`);
      return body as { roast: string; tone: string };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/statement-roast", activeMonth], data);
    },
    onError: (err: Error) => {
      console.error("[regenerate-statement-roast]", err);
      toast({ title: "Failed to regenerate", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const isPremium = me?.tier === "premium";
  const allBankExpenses = expenses?.filter(e => e.source === "bank_statement") ?? [];
  const manualExpenses = activeMonth
    ? allBankExpenses.filter(e => {
        const d = parseReceiptDate(e.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === activeMonth;
      })
    : allBankExpenses;

  const allSelected = manualExpenses.length > 0 && manualExpenses.every(e => selectedIds.has(e.id));

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowBulkConfirm(false);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(manualExpenses.map(e => e.id)));
    }
  }, [allSelected, manualExpenses]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await bulkDeleteMutation.mutateAsync(ids);
      exitSelectMode();
      toast({ title: `${ids.length} transaction${ids.length !== 1 ? "s" : ""} deleted` });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }, [selectedIds, bulkDeleteMutation, exitSelectMode, toast]);

  const scanStatement = async () => {
    if (!importData) return;
    setScanning(true);
    setPreviewResult(null);
    try {
      const res = await apiRequest("POST", "/api/expenses/preview-statement", {
        data: importData.data,
        format: importData.format,
        currency: importCurrency,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Scan failed");
      }
      const result: PreviewResult = await res.json();
      setPreviewResult(result);
      setEditMonth(result.detectedMonth);
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleImport = () => {
    if (!previewResult) return;
    importMutation.mutate(
      { transactions: previewResult.transactions, month: editMonth, tone, currency: importCurrency },
      {
        onSuccess: (data) => {
          const importedMonth = (data as any).month || editMonth;
          toast({ title: `Imported ${data.imported} transactions!`, description: "Statement roast ready below." });
          setImportData(null);
          setPreviewResult(null);
          if (importedMonth) setSelectedMonth(importedMonth);
          queryClient.invalidateQueries({ queryKey: ["/api/statement-months"] });
          queryClient.invalidateQueries({ queryKey: ["/api/statement-roast", importedMonth] });
          queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
        },
        onError: (err: any) => {
          toast({ title: "Import failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setPreviewResult(null);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");

    let processedFile = file;
    if (isHeic) {
      setConverting(true);
      try {
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        processedFile = new File([converted as Blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
      } finally {
        setConverting(false);
      }
    }

    const format: "pdf" | "image" = isPdf ? "pdf" : "image";
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportData({ data: e.target?.result as string, format, fileName: file.name });
    };
    reader.readAsDataURL(processedFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
    },
    maxFiles: 1,
  });

  const monthLabel = editMonth
    ? new Date(editMonth + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  if (!isPremium) {
    return (
      <div className="min-h-screen pb-24">
        <div className="bg-noise" />
        <AppNav />
        <main className="max-w-xl mx-auto px-4 sm:px-6 pt-16 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-[hsl(var(--secondary))]/20 border border-[hsl(var(--secondary))]/30 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-[hsl(var(--secondary))]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-3">Bank Statement Import</h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                Upload your bank or credit card statement and let Uncle Sergio roast every single transaction. Painful. Enlightening. Worth it.
              </p>
            </div>
            <div className="w-full glass-panel rounded-3xl p-6 text-left flex flex-col gap-3">
              {[
                { icon: "📄", text: "Import PDF or photo statements — bank or credit card" },
                { icon: "🔥", text: "Every transaction individually roasted and categorised automatically" },
                { icon: "🗂️", text: "Full transaction history, organised by month and category" },
                { icon: "⚖️", text: "Monthly verdict: a brutal summary of your spending habits" },
                { icon: "🎭", text: "Choose your roast tone — Roasted 🔥 or Destroyed 💀" },
                { icon: "🗑️", text: "Bulk select and delete transactions you'd rather forget" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <span className="text-lg shrink-0 mt-0.5">{icon}</span>
                  <p className="text-sm text-white/80">{text}</p>
                </div>
              ))}
            </div>
            <Link href="/pricing">
              <button
                data-testid="button-upgrade-bank"
                className="w-full px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white font-bold text-base hover:opacity-90 transition-opacity"
              >
                Upgrade to Premium — $9.99/mo
              </button>
            </Link>
            <p className="text-xs text-muted-foreground pb-4">
              Also includes unlimited receipt uploads, monthly tracker, and more.
            </p>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen pb-24">
      <div className="bg-noise" />
      <AppNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--secondary))]/20 border border-[hsl(var(--secondary))]/30 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[hsl(var(--secondary))]" />
            </div>
            <h1 className="text-4xl font-bold text-white">Bank Statement</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Upload your bank or credit card statement — PDF or photo. Every transaction gets roasted.
          </p>
        </motion.div>

        {/* ── Top row: import + roast side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 items-start">

          {/* Left: Tone selector + Import card */}
          <div ref={leftColRef}>
            {isPremium && (
              <div className="mb-5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Roast Tone — Uncle Sergio 🤌</label>
                <p className="text-xs text-muted-foreground/70 mb-2">Your fictional Italian uncle who can't believe what you're spending money on.</p>
                <div className="flex gap-2">
                  {TONES.map(t => (
                    <button key={t.value} type="button" onClick={() => setTone(t.value)}
                      data-testid={`button-tone-${t.value}`}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tone === t.value ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/40" : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-3xl p-6 flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Import Statement</h2>
                <p className="text-xs text-muted-foreground">Upload a PDF or photo of your bank or credit card statement. Up to 100 transactions per import.</p>
              </div>

              {converting ? (
                <div className="border-2 border-dashed border-[hsl(var(--secondary))]/40 rounded-2xl p-8 text-center">
                  <Loader2 className="w-8 h-8 text-[hsl(var(--secondary))] mx-auto mb-3 animate-spin" />
                  <p className="text-sm font-semibold text-white">Converting iPhone photo...</p>
                </div>
              ) : importData ? (
                <div className="border-2 border-[hsl(var(--secondary))]/40 bg-[hsl(var(--secondary))]/5 rounded-2xl p-5 flex items-center gap-4">
                  {importData.format === "pdf" ? (
                    <FileText className="w-8 h-8 text-[hsl(var(--secondary))] shrink-0" />
                  ) : (
                    <Image className="w-8 h-8 text-[hsl(var(--secondary))] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{importData.fileName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{importData.format} file — ready to scan</p>
                  </div>
                  <button onClick={() => { setImportData(null); setPreviewResult(null); }}
                    className="text-muted-foreground hover:text-white transition-colors text-xs underline shrink-0">
                    Remove
                  </button>
                </div>
              ) : (
                <div {...getRootProps()} data-testid="dropzone-import"
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${!isPremium ? "opacity-50 pointer-events-none" : ""} ${isDragActive ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))]/5" : "border-white/10 hover:border-[hsl(var(--secondary))]/40"}`}>
                  <input {...getInputProps()} disabled={!isPremium} />
                  <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white mb-1">Drop your statement here</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG, HEIC (iPhone) — or click to browse</p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Statement Currency</label>
                <select value={importCurrency} onChange={e => setImportCurrency(e.target.value)} disabled={!isPremium}
                  data-testid="select-import-currency"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors appearance-none cursor-pointer disabled:opacity-50">
                  {CURRENCIES.map(({ code, label }) => (
                    <option key={code} value={code} className="bg-[hsl(var(--background))]">{label}</option>
                  ))}
                </select>
              </div>

              {previewResult && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[hsl(var(--secondary))]/30 bg-[hsl(var(--secondary))]/5 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--secondary))] shrink-0" />
                    <p className="text-sm font-bold text-white">
                      {previewResult.transactionCount} transaction{previewResult.transactionCount !== 1 ? "s" : ""} found
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> Statement Month
                    </label>
                    <input type="month" value={editMonth} onChange={e => setEditMonth(e.target.value)}
                      data-testid="input-edit-month"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors"
                      style={{ colorScheme: "dark" }} />
                    <p className="text-xs text-muted-foreground mt-1">Confirm this matches your statement: <span className="text-white font-semibold">{monthLabel}</span>.</p>
                  </div>
                </motion.div>
              )}

              {importMutation.isError && (
                <div className="flex items-start gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {(importMutation.error as any)?.message}
                </div>
              )}

              {!previewResult ? (
                <button onClick={scanStatement} disabled={scanning || !importData || !isPremium} data-testid="button-scan-statement"
                  className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                  {scanning ? <><Loader2 className="w-5 h-5 animate-spin" /> Scanning...</> : <><FileText className="w-5 h-5" /> Scan Statement</>}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setPreviewResult(null)} disabled={importMutation.isPending}
                    className="px-5 py-4 rounded-2xl font-bold text-sm bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50">
                    Re-scan
                  </button>
                  <button onClick={handleImport} disabled={importMutation.isPending || !editMonth} data-testid="button-import-statement"
                    className="flex-1 py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                    {importMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Roasting...</> : <><Flame className="w-5 h-5" /> Import & Roast All</>}
                  </button>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right: Statement roast — matches left column height, scrollable content */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="flex flex-col"
            style={{ height: leftColHeight ?? "auto" }}>
            {isPremium && <div className="mb-5 h-[52px] shrink-0" />}
            <div
              data-testid="card-statement-roast"
              className="glass-panel rounded-3xl border border-[hsl(var(--primary))]/20 relative overflow-hidden flex flex-col flex-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/8 to-[hsl(var(--secondary))]/4 pointer-events-none" />
              <div className="relative flex flex-col h-full p-6 min-h-0">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block">Monthly Statement Roast</span>
                    {activeMonth && <span className="text-xs text-muted-foreground">{formatMonthLabel(activeMonth)}</span>}
                  </div>
                  {roastIsDirty && activeMonth && (
                    <button
                      data-testid="button-regenerate-statement-roast"
                      onClick={() => regenerateRoastMutation.mutate(activeMonth)}
                      disabled={regenerateRoastMutation.isPending}
                      title="Data changed — click to regenerate roast"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[hsl(var(--primary))]/70 hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 transition-all duration-200 disabled:opacity-50 shrink-0"
                    >
                      {regenerateRoastMutation.isPending
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCw className="w-3 h-3" />}
                      <span>Refresh</span>
                    </button>
                  )}
                </div>

                {roastLoading || regenerateRoastMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-center">
                    <Loader2 className="w-7 h-7 text-[hsl(var(--primary))] mb-3 animate-spin" />
                    <p className="text-xs text-muted-foreground">
                      {regenerateRoastMutation.isPending ? "Regenerating roast..." : "Loading roast..."}
                    </p>
                  </div>
                ) : statementRoast ? (
                  <div className="overflow-y-auto flex-1 min-h-0 pr-1">
                    {statementRoast.split(/\n/).map((line, i) =>
                      line.trim() === "Field Notes:" ? (
                        <p key={i} className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--primary))]/70 mt-4 mb-1">{line}</p>
                      ) : line.trim() === "" ? (
                        <div key={i} className="h-3" />
                      ) : (
                        <p key={i} className="text-sm text-white/90 leading-relaxed">{line}</p>
                      )
                    )}
                  </div>
                ) : activeMonth && manualExpenses.length > 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-center gap-4">
                    <div className="opacity-40">
                      <Flame className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">No roast generated yet.</p>
                    </div>
                    <button
                      data-testid="button-generate-statement-roast"
                      onClick={() => setShowGenerateConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--primary))]/25 transition-all duration-200"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Monthly Roast
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-center opacity-35">
                    <Flame className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">Import a statement and it will be roasted here.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Full-width transactions card ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-xl font-bold text-white">
              Roasted Transactions {manualExpenses.length > 0 && <span className="text-base font-normal text-muted-foreground ml-1">({manualExpenses.length})</span>}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              {availableMonths.length > 0 && !selectMode && (
                <div className="flex gap-2 flex-wrap">
                  {availableMonths.map(m => (
                    <button key={m} onClick={() => setSelectedMonth(m)}
                      data-testid={`button-month-${m}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeMonth === m ? "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))] border border-[hsl(var(--secondary))]/40" : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"}`}>
                      {formatMonthLabel(m)}
                    </button>
                  ))}
                </div>
              )}
              {/* Select mode controls */}
              {manualExpenses.length > 0 && (
                <div className="flex items-center gap-3">
                  {selectMode ? (
                    <>
                      <button
                        data-testid="button-select-all-bank"
                        onClick={toggleSelectAll}
                        className="text-sm font-semibold text-[hsl(var(--primary))] hover:opacity-80 transition-opacity"
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                      <button
                        data-testid="button-cancel-select-bank"
                        onClick={exitSelectMode}
                        className="flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      data-testid="button-enter-select-mode-bank"
                      onClick={enterSelectMode}
                      className="text-sm font-semibold text-white/50 hover:text-white/90 transition-colors"
                    >
                      Select
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {manualExpenses.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">
                {isPremium ? "No statements imported yet. Upload your first one above." : "Upgrade to Premium to start importing statements."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: 540 }}>
              {manualExpenses.map((exp, i) => {
                const isSelected = selectedIds.has(exp.id);
                return (
                  <motion.div key={exp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    data-testid={`card-manual-${exp.id}`}
                    onClick={selectMode ? () => toggleSelect(exp.id) : undefined}
                    className={`glass-panel rounded-2xl group relative transition-all duration-150 ${selectMode ? "cursor-pointer" : ""} ${isSelected ? "border border-[hsl(var(--primary))]/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]" : ""}`}
                    style={{ padding: "10px 14px 12px 14px" }}
                  >
                    {/* Checkbox overlay in select mode */}
                    {selectMode && (
                      <div
                        className={`absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${isSelected ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]" : "border-white/30 bg-white/5"}`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                      </div>
                    )}
                    {!selectMode && (
                      <div style={{ marginBottom: 8 }}>
                        <EditableCategoryPill expenseId={exp.id} category={exp.category} onCategoryChanged={handleCategoryChanged} />
                      </div>
                    )}
                    <div className={`flex items-start gap-3 ${selectMode ? "pl-8" : ""}`}>
                      <div className="bg-[hsl(var(--secondary))]/10 border border-[hsl(var(--secondary))]/20 rounded-xl p-2.5 shrink-0 mt-0.5">
                        <Wallet className="w-4 h-4 text-[hsl(var(--secondary))]" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-bold text-white text-sm truncate">{exp.description}</p>
                          <span className="text-base font-amount-card text-white shrink-0">
                            {(exp.amount / 100).toLocaleString(undefined, { style: "currency", currency: (exp as any).currency || "USD" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{parseReceiptDate(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                        {!selectMode && (reRoastingSet.has(exp.id) ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Loader2 className="w-3.5 h-3.5 text-[hsl(var(--primary))] animate-spin shrink-0" />
                            <p className="text-xs text-muted-foreground italic">Regenerating roast...</p>
                          </div>
                        ) : exp.roast ? (
                          <div className="flex items-start gap-2 mt-2">
                            <p className="text-sm italic text-white/70 leading-relaxed flex-1">"{exp.roast}"</p>
                            <ShareButton
                              text={`🔥 "${exp.roast}"\n\n— ${(exp.amount / 100).toLocaleString(undefined, { style: "currency", currency: (exp as any).currency || "USD" })} at ${exp.description} · Expense Roaster`}
                              label="Share 🔥"
                              variant="full"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[hsl(var(--primary))]/35 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 transition-all duration-200 shrink-0"
                            />
                          </div>
                        ) : null)}
                      </div>
                    </div>
                    {!selectMode && (
                      <button onClick={() => deleteMutation.mutate(exp.id)} disabled={deleteMutation.isPending}
                        data-testid={`button-delete-manual-${exp.id}`}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>

    {/* Sticky delete bar */}
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
              data-testid="button-bulk-delete-bank"
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
                ? "Select transactions to delete"
                : `Delete (${selectedIds.size} selected)`}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Bulk delete confirmation */}
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
            className="glass-panel rounded-3xl p-7 max-w-sm w-full border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Delete {selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkConfirm(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-white/5 hover:bg-white/10 text-muted-foreground border border-white/10 transition-all">
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-destructive hover:bg-destructive/90 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showGenerateConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowGenerateConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-panel rounded-3xl p-7 max-w-sm w-full border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--primary))]/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-[hsl(var(--primary))]" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Ready to generate your roast?
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-1">
              Before generating, make sure:
            </p>
            <ul className="text-sm text-muted-foreground text-left mb-6 mt-2 space-y-1 px-2">
              <li className="flex items-start gap-2"><span className="mt-0.5 text-[hsl(var(--primary))]">•</span>All bank statements for {activeMonth ? formatMonthLabel(activeMonth) : "this month"} have been uploaded</li>
              <li className="flex items-start gap-2"><span className="mt-0.5 text-[hsl(var(--primary))]">•</span>Transaction categories look correct</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGenerateConfirm(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-white/5 hover:bg-white/10 text-muted-foreground border border-white/10 transition-all"
              >
                Not yet
              </button>
              <button
                data-testid="button-confirm-generate-roast"
                onClick={() => {
                  setShowGenerateConfirm(false);
                  if (activeMonth) regenerateRoastMutation.mutate(activeMonth);
                }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white transition-all flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4" />
                Roast me
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
