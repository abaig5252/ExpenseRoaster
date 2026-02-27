import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Wallet, UploadCloud, Plus, Flame, Check, Trash2, Calendar, DollarSign, AlertCircle, Loader2 } from "lucide-react";
import { useAddManualExpense, useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { AppNav } from "@/components/AppNav";

const CATEGORIES = ["Food & Drink", "Shopping", "Transport", "Entertainment", "Health", "Subscriptions", "Other"];

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
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const addMutation = useAddManualExpense();
  const deleteMutation = useDeleteExpense();
  const { data: expenses } = useExpenses();

  // Only show manually or bank_statement sourced expenses
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
      { amount: amountCents, description: form.description.trim(), category: form.category, date: form.date, source: form.source },
      {
        onSuccess: (data) => {
          setSubmitted(data.roast);
          setForm(empty);
          setErrors({});
          setTimeout(() => setSubmitted(null), 6000);
        },
      }
    );
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-noise" />
      <AppNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--secondary))]/20 border border-[hsl(var(--secondary))]/30 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[hsl(var(--secondary))]" />
            </div>
            <h1 className="text-4xl font-display font-black text-white">Bank Statement</h1>
          </div>
          <p className="text-muted-foreground text-lg ml-13">
            Log expenses manually or from your bank statement. Every entry comes with a custom roast.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 flex flex-col gap-5">
              <h2 className="text-xl font-display font-bold text-white">Add Expense</h2>

              {/* Source toggle */}
              <div className="flex gap-2">
                {(["manual", "bank_statement"] as const).map(src => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, source: src }))}
                    data-testid={`button-source-${src}`}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      form.source === src
                        ? "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))] border border-[hsl(var(--secondary))]/40"
                        : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"
                    }`}
                  >
                    {src === "manual" ? "Manual Entry" : "Bank Statement"}
                  </button>
                ))}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Uber Eats delivery"
                  value={form.description}
                  onChange={set("description")}
                  data-testid="input-description"
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors ${
                    errors.description ? "border-destructive/50" : "border-white/10"
                  }`}
                />
                {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Amount ($)</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={set("amount")}
                      data-testid="input-amount"
                      className={`w-full bg-white/5 border rounded-xl pl-9 pr-4 py-3 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors ${
                        errors.amount ? "border-destructive/50" : "border-white/10"
                      }`}
                    />
                  </div>
                  {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={form.date}
                      onChange={set("date")}
                      data-testid="input-date"
                      className={`w-full bg-white/5 border rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors ${
                        errors.date ? "border-destructive/50" : "border-white/10"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Category</label>
                <select
                  value={form.category}
                  onChange={set("category")}
                  data-testid="select-category"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[hsl(var(--secondary))]/60 transition-colors appearance-none cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-[hsl(var(--background))]">{cat}</option>
                  ))}
                </select>
              </div>

              {addMutation.isError && (
                <div className="flex items-start gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {addMutation.error?.message}
                </div>
              )}

              <button
                type="submit"
                disabled={addMutation.isPending}
                data-testid="button-add-expense"
                className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60"
              >
                {addMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Generating Roast...</>
                ) : (
                  <><Plus className="w-5 h-5" /> Add & Roast</>
                )}
              </button>
            </form>

            {/* Roast notification */}
            <AnimatePresence>
              {submitted && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 glass-panel rounded-2xl p-5 border border-[hsl(var(--primary))]/30"
                >
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
          </motion.div>

          {/* Manual expense list */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-xl font-display font-bold text-white mb-4">Manually Logged ({manualExpenses.length})</h2>
            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
              {manualExpenses.length === 0 ? (
                <div className="glass-panel rounded-3xl p-10 text-center">
                  <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No manual entries yet.<br />Add your first expense above.</p>
                </div>
              ) : manualExpenses.map((exp, i) => (
                <motion.div
                  key={exp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  data-testid={`card-manual-${exp.id}`}
                  className="glass-panel rounded-2xl p-4 flex items-start gap-4 group relative"
                >
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
                      <span className="text-xs text-muted-foreground">
                        {new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-xs italic text-muted-foreground mt-2 line-clamp-2">"{exp.roast}"</p>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(exp.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-manual-${exp.id}`}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                  >
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
