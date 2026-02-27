import { useState } from "react";
import { motion } from "framer-motion";
import { Flame, Plus, DollarSign, RefreshCw, Trash2 } from "lucide-react";
import { useExpenses, useExpenseSummary, useDeleteExpense } from "@/hooks/use-expenses";
import { ExpenseCard } from "@/components/ExpenseCard";
import { UploadModal } from "@/components/UploadModal";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/hooks/use-auth";

export default function Upload() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const { user } = useAuth();
  const { data: expenses, isLoading, error } = useExpenses();
  const { data: summary, isLoading: summaryLoading } = useExpenseSummary();
  const deleteMutation = useDeleteExpense();

  const formattedTotal = summary
    ? (summary.monthlyTotal / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0.00";

  const firstName = user?.firstName || user?.email?.split("@")[0] || "friend";

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
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-14">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest mb-3">
              Hey {firstName}, here's your damage report
            </p>
            <div className="flex items-end gap-3">
              {summaryLoading ? (
                <div className="h-20 w-56 bg-white/5 rounded-2xl animate-pulse" />
              ) : (
                <h1 className="text-6xl md:text-8xl font-display font-black text-white leading-none">
                  {formattedTotal}
                </h1>
              )}
            </div>
            <p className="text-muted-foreground mt-3 text-lg">
              spent this month on things you <span className="text-[hsl(var(--primary))] font-semibold">definitely needed.</span>
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            onClick={() => setIsUploadOpen(true)}
            data-testid="button-upload-receipt"
            className="group relative px-8 py-5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] rounded-2xl font-display font-bold text-xl text-white btn-glow transition-all duration-300 flex items-center gap-3 shrink-0"
          >
            <Plus className="w-6 h-6" />
            <span>Upload Receipt</span>
          </motion.button>
        </header>

        {/* Expense list */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="w-6 h-6 text-muted-foreground" />
            <h2 className="text-2xl font-display font-bold text-white">Your Recent Disasters</h2>
            {expenses?.length ? (
              <span className="px-2.5 py-0.5 bg-white/10 rounded-full text-xs font-bold text-muted-foreground">
                {expenses.length}
              </span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-panel rounded-3xl p-6 h-64 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <RefreshCw className="w-10 h-10 text-destructive mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Failed to load</h3>
              <p className="text-muted-foreground">Servers down. Like your savings.</p>
            </div>
          ) : expenses?.length === 0 ? (
            <div className="glass-panel border-dashed border-white/10 rounded-3xl p-16 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5">
                <Flame className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-3xl font-display font-bold mb-3">Suspiciously clean...</h3>
              <p className="text-lg text-muted-foreground max-w-md mb-8">
                Either you have incredible self-control or you're too afraid to face the truth. Upload a receipt.
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                data-testid="button-upload-first"
                className="px-8 py-4 rounded-2xl font-display font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white btn-glow"
              >
                Face Your Finances
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {expenses?.map((expense, i) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  index={i}
                  onDelete={() => deleteMutation.mutate(expense.id)}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </div>
  );
}
