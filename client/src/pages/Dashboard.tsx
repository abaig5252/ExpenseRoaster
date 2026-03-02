import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Flame, Activity, DollarSign, RefreshCw } from "lucide-react";
import { useExpenses, useExpenseSummary } from "@/hooks/use-expenses";
import { ExpenseCard } from "@/components/ExpenseCard";
import { UploadModal } from "@/components/UploadModal";

export default function Dashboard() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  
  const { data: expenses, isLoading: expensesLoading, error: expensesError } = useExpenses();
  const { data: summary, isLoading: summaryLoading } = useExpenseSummary();

  const formattedTotal = summary 
    ? (summary.monthlyTotal / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0.00";

  return (
    <div className="min-h-screen pb-24 relative">
      <div className="bg-noise" />
      
      {/* Decorative background elements */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-[hsl(var(--primary))] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      {/* Marquee Banner */}
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
            {/* Duplicate for seamless loop */}
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
        
        {/* Header Section */}
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

        {/* Expenses Grid */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <DollarSign className="w-6 h-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">Recent Disasters</h2>
          </div>

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
          ) : expenses?.length === 0 ? (
            <div className="glass-panel border-dashed border-white/20 rounded-3xl p-16 text-center flex flex-col items-center justify-center">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Flame className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-4">Too clean...</h3>
              <p className="text-xl text-muted-foreground max-w-lg mb-8">
                You haven't uploaded any receipts yet. Are you actually saving money or just hiding your shame?
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-6 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Upload First Receipt
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {expenses?.map((expense, i) => (
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
