import { useState, useCallback } from "react";
import { parseReceiptDate } from "@/lib/dates";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Wallet, UploadCloud, Flame, Trash2, AlertCircle, Loader2, FileText, Lock, Image } from "lucide-react";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { useMe, useImportCSV } from "@/hooks/use-subscription";
import { useCurrency, CURRENCIES } from "@/hooks/use-currency";
import { AppNav } from "@/components/AppNav";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function BankStatement() {
  const { currency: headerCurrency } = useCurrency();
  const [importCurrency, setImportCurrency] = useState<string>(headerCurrency || "USD");
  const [tone, setTone] = useState("savage");
  const [importData, setImportData] = useState<{ data: string; format: "pdf" | "image"; fileName: string } | null>(null);
  const [converting, setConverting] = useState(false);

  const { data: me } = useMe();
  const importMutation = useImportCSV();
  const deleteMutation = useDeleteExpense();
  const { data: expenses } = useExpenses();
  const { toast } = useToast();

  const isPremium = me?.tier === "premium";
  const manualExpenses = expenses?.filter(e => e.source === "manual" || e.source === "bank_statement") ?? [];

  const TONES = [
    { value: "savage", label: "Savage 🔥" },
    { value: "playful", label: "Playful 😄" },
    { value: "supportive", label: "Supportive 💛" },
  ];

  const handleImport = () => {
    if (!importData) return;
    importMutation.mutate({ data: importData.data, format: importData.format, tone, currency: importCurrency }, {
      onSuccess: (data) => {
        toast({ title: `Imported ${data.imported} transactions!`, description: "Each one came with its own roast." });
        setImportData(null);
      },
      onError: (err: any) => {
        toast({ title: "Import failed", description: err.message, variant: "destructive" });
      },
    });
  };

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

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
                    <p className="text-xs text-muted-foreground capitalize">{importData.format} file — ready to import</p>
                  </div>
                  <button onClick={() => setImportData(null)} className="text-muted-foreground hover:text-white transition-colors text-xs underline shrink-0">
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

              {importMutation.isError && (
                <div className="flex items-start gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {(importMutation.error as any)?.message}
                </div>
              )}

              <button onClick={handleImport} disabled={importMutation.isPending || !importData || !isPremium} data-testid="button-import-statement"
                className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                {importMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Importing & Roasting...</> : <><FileText className="w-5 h-5" /> Import & Roast All</>}
              </button>
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
                  data-testid={`card-manual-${exp.id}`} className="glass-panel rounded-2xl p-4 flex items-start gap-4 group relative">
                  <div className="bg-[hsl(var(--secondary))]/10 border border-[hsl(var(--secondary))]/20 rounded-xl p-2.5 shrink-0">
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
                      <span className="text-xs text-muted-foreground">{exp.category}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-xs text-muted-foreground">{parseReceiptDate(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                    {exp.roast && <p className="text-xs italic text-muted-foreground mt-2 line-clamp-2">"{exp.roast}"</p>}
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
