import { motion } from "framer-motion";
import { Receipt, Calendar, Tag, Flame } from "lucide-react";
import type { ExpenseResponse } from "@shared/routes";

interface ExpenseCardProps {
  expense: ExpenseResponse;
  index: number;
}

export function ExpenseCard({ expense, index }: ExpenseCardProps) {
  const formattedAmount = (expense.amount / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(expense.date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
      className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col h-full relative overflow-hidden group"
    >
      {/* Decorative gradient orb behind content */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-[hsl(var(--primary))] rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="bg-white/5 rounded-2xl p-3 inline-flex items-center justify-center border border-white/10">
          <Receipt className="w-6 h-6 text-[hsl(var(--secondary))]" />
        </div>
        <div className="text-right">
          <span className="text-3xl font-display font-bold text-foreground block">
            {formattedAmount}
          </span>
          <div className="flex items-center justify-end text-xs text-muted-foreground mt-1 gap-1">
            <Calendar className="w-3 h-3" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 relative z-10">
        <h3 className="text-lg font-bold text-foreground leading-tight mb-1">
          {expense.description}
        </h3>
        <div className="flex items-center text-xs font-semibold uppercase tracking-wider text-[hsl(var(--accent))] gap-1.5">
          <Tag className="w-3 h-3" />
          {expense.category}
        </div>
      </div>

      {/* The Roast */}
      <div className="mt-auto pt-4 border-t border-white/10 relative z-10">
        <div className="flex items-start gap-3 bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/20 rounded-2xl p-4">
          <Flame className="w-5 h-5 text-[hsl(var(--destructive))] shrink-0 mt-0.5" />
          <p className="text-sm italic text-foreground/90 font-medium leading-relaxed">
            "{expense.roast}"
          </p>
        </div>
      </div>
    </motion.div>
  );
}
