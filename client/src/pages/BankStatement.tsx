import { useState, useCallback, useRef, useEffect } from "react";
import { parseReceiptDate } from "@/lib/dates";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Wallet, UploadCloud, Flame, Trash2, AlertCircle, Loader2, FileText, Lock, Image, Calendar, CheckCircle2, ChevronDown } from "lucide-react";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { useMe, useImportCSV } from "@/hooks/use-subscription";
import { CURRENCIES } from "@/hooks/use-currency";
import { AppNav } from "@/components/AppNav";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type PreviewResult = {
  transactions: { description: string; amount: number; date: string }[];
  detectedMonth: string;
  transactionCount: number;
  location: string | null;
};

const TONES = [
  { value: "hells_kitchen", label: "Hell's Kitchen 🔪" },
  { value: "medium_rare",   label: "Medium Rare 🥩" },
  { value: "gentle_nudge",  label: "Gentle Nudge 🌱" },
];

const ALL_CATEGORIES = [
  "Food & Drink",
  "Groceries",
  "Shopping",
  "Transport",
  "Travel",
  "Entertainment",
  "Health & Fitness",
  "Subscriptions",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink": "#E85D26",
  "Groceries": "#C4A832",
  "Shopping": "#C4A832",
  "Transport": "#3BB8A0",
  "Travel": "#4A9FE8",
  "Entertainment": "#E8526A",
  "Health & Fitness": "#5BA85E",
  "Subscriptions": "#7B6FE8",
  "Coffee": "#7B6FE8",
  "Other": "#4A5060",
};

function EditableCategoryPill({ expenseId, category }: { expenseId: number; category: string }) {
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
      toast({ title: "Category updated", description: "AI will remember this for future imports." });
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
  const [tone, setTone] = useState("hells_kitchen");
  const [importData, setImportData] = useState<{ data: string; format: "pdf" | "image"; fileName: string } | null>(null);
  const [converting, setConverting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [editMonth, setEditMonth] = useState("");

  const { data: me } = useMe();
  const importMutation = useImportCSV();
  const deleteMutation = useDeleteExpense();
  const { data: expenses } = useExpenses();
  const { toast } = useToast();

  const isPremium = me?.tier === "premium";
  const manualExpenses = expenses?.filter(e => e.source === "manual" || e.source === "bank_statement") ?? [];

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
          toast({ title: `Imported ${data.imported} transactions!`, description: "Each one came with its own roast." });
          setImportData(null);
          setPreviewResult(null);
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

  return (
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

        {!isPremium && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-panel rounded-2xl p-5 mb-6 border border-[hsl(var(--primary))]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">Statement import requires Premium</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upgrade to import bank or credit card statements, PDF or photo, and track your full history.</p>
              </div>
            </div>
            <Link href="/pricing">
              <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white text-sm font-bold whitespace-nowrap hover:opacity-90 transition-all" data-testid="button-upgrade-bank">
                Upgrade — $9.99/mo
              </button>
            </Link>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Import section */}
          <div>
            {/* Tone selector */}
            {isPremium && (
              <div className="mb-5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Roast Tone</label>
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

            {/* Import card */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-3xl p-6 flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Import Statement</h2>
                <p className="text-xs text-muted-foreground">Upload a PDF or photo of your bank or credit card statement. Up to 100 transactions per import.</p>
              </div>

              {/* File drop zone */}
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

              {/* Currency */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Statement Currency</label>
                <select
                  value={importCurrency}
                  onChange={e => setImportCurrency(e.target.value)}
                  disabled={!isPremium}
                  data-testid="select-import-currency"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors appearance-none cursor-pointer disabled:opacity-50"
                >
                  {CURRENCIES.map(({ code, label }) => (
                    <option key={code} value={code} className="bg-[hsl(var(--background))]">{label}</option>
                  ))}
                </select>
              </div>

              {/* Preview result — shown after scan */}
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
                    <input
                      type="month"
                      value={editMonth}
                      onChange={e => setEditMonth(e.target.value)}
                      data-testid="input-edit-month"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors"
                      style={{ colorScheme: "dark" }}
                    />
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

              {/* Step 1: Scan */}
              {!previewResult && (
                <button onClick={scanStatement} disabled={scanning || !importData || !isPremium} data-testid="button-scan-statement"
                  className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                  {scanning
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Scanning...</>
                    : <><FileText className="w-5 h-5" /> Scan Statement</>}
                </button>
              )}

              {/* Step 2: Import & Roast */}
              {previewResult && (
                <div className="flex gap-3">
                  <button onClick={() => setPreviewResult(null)} disabled={importMutation.isPending}
                    className="px-5 py-4 rounded-2xl font-bold text-sm bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50">
                    Re-scan
                  </button>
                  <button onClick={handleImport} disabled={importMutation.isPending || !editMonth} data-testid="button-import-statement"
                    className="flex-1 py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                    {importMutation.isPending
                      ? <><Loader2 className="w-5 h-5 animate-spin" /> Roasting...</>
                      : <><Flame className="w-5 h-5" /> Import & Roast All</>}
                  </button>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right: Expense list */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-xl font-bold text-white mb-4">Imported Expenses ({manualExpenses.length})</h2>
            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
              {manualExpenses.length === 0 ? (
                <div className="glass-panel rounded-3xl p-10 text-center">
                  <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {isPremium ? "No statements imported yet. Upload your first one above." : "Upgrade to Premium to start importing statements."}
                  </p>
                </div>
              ) : manualExpenses.map((exp, i) => (
                <motion.div key={exp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  data-testid={`card-manual-${exp.id}`}
                  className="glass-panel rounded-2xl group relative"
                  style={{ padding: "10px 14px 12px 14px" }}
                >
                  {/* Category pill — top left */}
                  <div style={{ marginBottom: 8 }}>
                    <EditableCategoryPill expenseId={exp.id} category={exp.category} />
                  </div>

                  {/* Scrollable content area */}
                  <div style={{ maxHeight: 120, overflowY: "auto", paddingRight: 4 }}>
                    <div className="flex items-start gap-3">
                      {/* Wallet icon — sits below pill */}
                      <div className="bg-[hsl(var(--secondary))]/10 border border-[hsl(var(--secondary))]/20 rounded-xl p-2.5 shrink-0 mt-0.5">
                        <Wallet className="w-4 h-4 text-[hsl(var(--secondary))]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-bold text-white text-sm truncate">{exp.description}</p>
                          <span className="text-base font-amount-card text-white shrink-0">
                            {(exp.amount / 100).toLocaleString(undefined, { style: "currency", currency: (exp as any).currency || "USD" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{parseReceiptDate(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                        {exp.roast && <p className="text-xs italic text-muted-foreground mt-2">"{exp.roast}"</p>}
                      </div>
                    </div>
                  </div>

                  <button onClick={() => deleteMutation.mutate(exp.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-manual-${exp.id}`}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
