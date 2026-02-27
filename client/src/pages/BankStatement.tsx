import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Wallet, UploadCloud, Plus, Flame, Trash2, Calendar, DollarSign, AlertCircle, Loader2, FileText, Lock } from "lucide-react";
import { useAddManualExpense, useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { useMe, useImportCSV } from "@/hooks/use-subscription";
import { AppNav } from "@/components/AppNav";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["Food & Drink", "Shopping", "Transport", "Entertainment", "Health", "Subscriptions", "Other"];
const TONES = [
  { value: "savage", label: "Savage 🔥" },
  { value: "playful", label: "Playful 😄" },
  { value: "supportive", label: "Supportive 💛" },
];

type FormState = {
  description: string;
  amount: string;
  category: string;
  date: string;
  source: "manual" | "bank_statement";
};

const empty: FormState = {
  description: "",
  amount: "",
  category: "Other",
  date: new Date().toISOString().split("T")[0],
  source: "manual",
};

export default function BankStatement() {
  const [form, setForm] = useState<FormState>(empty);
  const [tone, setTone] = useState("savage");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [csvText, setCsvText] = useState("");

  const { data: me } = useMe();
  const addMutation = useAddManualExpense();
  const importMutation = useImportCSV();
  const deleteMutation = useDeleteExpense();
  const { data: expenses } = useExpenses();
  const { toast } = useToast();

  const isPremium = me?.tier === "premium";
  const manualExpenses = expenses?.filter(e => e.source === "manual" || e.source === "bank_statement") ?? [];

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.description.trim()) errs.description = "Required";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) errs.amount = "Valid amount required";
    if (!form.date) errs.date = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const amountCents = Math.round(Number(form.amount) * 100);
    addMutation.mutate(
      { amount: amountCents, description: form.description.trim(), category: form.category, date: form.date, source: form.source, tone },
      {
        onSuccess: (data) => {
          setSubmitted(data.roast);
          setForm(empty);
          setErrors({});
          setTimeout(() => setSubmitted(null), 6000);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleCSVImport = () => {
    if (!csvText.trim()) return;
    importMutation.mutate({ csvData: csvText, tone }, {
      onSuccess: (data) => {
        toast({ title: `Imported ${data.imported} transactions!`, description: "Each one came with its own roast." });
        setCsvText("");
      },
      onError: (err: any) => {
        toast({ title: "Import failed", description: err.message, variant: "destructive" });
      },
    });
  };

  // CSV dropzone
  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(e.target?.result as string || "");
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".txt"] },
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
            <h1 className="text-4xl font-display font-black text-white">Bank Statement</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Log expenses manually or import a CSV bank statement. Every entry gets roasted.
          </p>
        </motion.div>

        {!isPremium && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-panel rounded-2xl p-5 mb-6 border border-[hsl(var(--primary))]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">Manual entry & CSV import require Premium</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upgrade to log expenses, import bank statements, and track your full history.</p>
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
          {/* Left: Input section */}
          <div>
            {/* Tabs */}
            {isPremium && (
              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => setActiveTab("manual")}
                  data-testid="tab-manual"
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "manual" ? "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))] border border-[hsl(var(--secondary))]/40" : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"}`}
                >
                  Manual Entry
                </button>
                <button
                  onClick={() => setActiveTab("csv")}
                  data-testid="tab-csv"
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "csv" ? "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))] border border-[hsl(var(--secondary))]/40" : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"}`}
                >
                  Import CSV
                </button>
              </div>
            )}

            {/* Tone selector (premium) */}
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

            {/* Manual form */}
            {(!isPremium || activeTab === "manual") && (
              <motion.form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 flex flex-col gap-5">
                <h2 className="text-xl font-display font-bold text-white">Add Expense</h2>

                {!isPremium && (
                  <div className="flex gap-2">
                    {(["manual", "bank_statement"] as const).map(src => (
                      <button key={src} type="button" onClick={() => setForm(f => ({ ...f, source: src }))}
                        disabled={!isPremium}
                        data-testid={`button-source-${src}`}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${form.source === src ? "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))] border border-[hsl(var(--secondary))]/40" : "bg-white/5 text-muted-foreground border border-transparent"} ${!isPremium ? "opacity-50 cursor-not-allowed" : ""}`}>
                        {src === "manual" ? "Manual Entry" : "Bank Statement"}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</label>
                  <input type="text" placeholder="e.g. Uber Eats delivery" value={form.description} onChange={set("description")} disabled={!isPremium} data-testid="input-description"
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors disabled:opacity-50 ${errors.description ? "border-destructive/50" : "border-white/10"}`} />
                  {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Amount ($)</label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={set("amount")} disabled={!isPremium} data-testid="input-amount"
                        className={`w-full bg-white/5 border rounded-xl pl-9 pr-4 py-3 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors disabled:opacity-50 ${errors.amount ? "border-destructive/50" : "border-white/10"}`} />
                    </div>
                    {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date</label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="date" value={form.date} onChange={set("date")} disabled={!isPremium} data-testid="input-date"
                        className={`w-full bg-white/5 border rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors disabled:opacity-50 ${errors.date ? "border-destructive/50" : "border-white/10"}`} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Category</label>
                  <select value={form.category} onChange={set("category")} disabled={!isPremium} data-testid="select-category"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors appearance-none cursor-pointer disabled:opacity-50">
                    {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[hsl(var(--background))]">{cat}</option>)}
                  </select>
                </div>

                {addMutation.isError && (
                  <div className="flex items-start gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {(addMutation.error as any)?.message}
                  </div>
                )}

                <button type="submit" disabled={addMutation.isPending || !isPremium} data-testid="button-add-expense"
                  className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                  {addMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating Roast...</> : <><Plus className="w-5 h-5" /> Add & Roast</>}
                </button>
              </motion.form>
            )}

            {/* CSV import */}
            {isPremium && activeTab === "csv" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-3xl p-6 flex flex-col gap-5">
                <div>
                  <h2 className="text-xl font-display font-bold text-white mb-1">Import CSV Bank Statement</h2>
                  <p className="text-xs text-muted-foreground">Upload or paste a CSV with columns: Date, Description/Merchant, Amount. Up to 100 rows per import.</p>
                </div>

                {/* Dropzone */}
                <div {...getRootProps()} data-testid="dropzone-csv"
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragActive ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))]/5" : "border-white/10 hover:border-[hsl(var(--secondary))]/40"}`}>
                  <input {...getInputProps()} />
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white mb-1">Drop CSV file here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Or paste CSV data</label>
                  <textarea value={csvText} onChange={e => setCsvText(e.target.value)} data-testid="input-csv"
                    placeholder={"Date,Description,Amount\n2024-01-15,Starbucks,6.50\n2024-01-16,Amazon,47.99"}
                    rows={6} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors font-mono resize-none" />
                </div>

                {importMutation.isError && (
                  <div className="flex items-start gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {(importMutation.error as any)?.message}
                  </div>
                )}

                <button onClick={handleCSVImport} disabled={importMutation.isPending || !csvText.trim()} data-testid="button-import-csv"
                  className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                  {importMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Importing & Roasting...</> : <><FileText className="w-5 h-5" /> Import & Roast All</>}
                </button>
              </motion.div>
            )}

            {/* Roast notification */}
            <AnimatePresence>
              {submitted && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
                  className="mt-4 glass-panel rounded-2xl p-5 border border-[hsl(var(--primary))]/30">
                  <div className="flex items-start gap-3">
                    <Flame className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))] mb-1">Fresh Roast</p>
                      <p className="text-white italic text-sm">"{submitted}"</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Expense list */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-xl font-display font-bold text-white mb-4">Logged Expenses ({manualExpenses.length})</h2>
            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
              {manualExpenses.length === 0 ? (
                <div className="glass-panel rounded-3xl p-10 text-center">
                  <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {isPremium ? "No manual entries yet. Add your first expense above." : "Upgrade to Premium to start logging expenses."}
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
                      <span className="text-base font-display font-black text-white shrink-0">
                        {(exp.amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{exp.category}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-xs text-muted-foreground">{new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                    <p className="text-xs italic text-muted-foreground mt-2 line-clamp-2">"{exp.roast}"</p>
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
