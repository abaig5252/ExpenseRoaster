import { motion } from "framer-motion";
import { Receipt, Calendar, Tag, Flame, Trash2, CreditCard, FileText } from "lucide-react";
import type { ExpenseResponse } from "@shared/routes";

interface ExpenseCardProps {
  expense: ExpenseResponse;
  index: number;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const categoryColors: Record<string, string> = {
  "Food & Drink": "hsl(var(--primary))",
  "Shopping": "hsl(var(--secondary))",
  "Transport": "hsl(var(--accent))",
  "Entertainment": "270, 90%, 65%",
  "Health": "140, 80%, 50%",
  "Subscriptions": "200, 100%, 55%",
  "Other": "260, 20%, 60%",
};

const sourceIcon = (source: string | null) => {
  if (source === "bank_statement") return <FileText className="w-3 h-3" />;
  if (source === "manual") return <CreditCard className="w-3 h-3" />;
  return <Receipt className="w-3 h-3" />;
};

export function ExpenseCard({ expense, index, onDelete, isDeleting }: ExpenseCardProps) {
  const formattedAmount = (expense.amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(expense.date));
  const color = categoryColors[expense.category] || categoryColors["Other"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: "easeOut" }}
      data-testid={`card-expense-${expense.id}`}
      className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col relative overflow-hidden group"
    >
      <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full opacity-20 group-hover:opacity-35 transition-opacity duration-500 blur-[60px]"
        style={{ background: `hsl(${color})` }} />

      {/* Top row */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10 flex items-center justify-center">
          <Receipt className="w-5 h-5" style={{ color: `hsl(${color})` }} />
        </div>
        <div className="text-right">
          <span className="text-2xl font-amount-card text-white block">{formattedAmount}</span>
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
            <Calendar className="w-3 h-3" />
            {formattedDate}
          </div>
        </div>
      </div>

      {/* Description & category */}
      <div className="mb-5 relative z-10">
        <h3 className="text-base font-bold text-white leading-tight mb-1.5">{expense.description}</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: `hsl(${color})` }}>
            <Tag className="w-3 h-3" />
            {expense.category}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {sourceIcon(expense.source)}
            <span className="capitalize">{expense.source || "receipt"}</span>
          </div>
        </div>
      </div>

      {/* Roast */}
      <div className="mt-auto pt-4 border-t border-white/[0.07] relative z-10">
        <div className="flex items-start gap-2.5 bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/20 rounded-2xl p-3.5">
          <Flame className="w-4 h-4 text-[hsl(var(--destructive))] shrink-0 mt-0.5" />
          <p className="font-roast text-sm text-white/85 leading-relaxed">"{expense.roast}"</p>
        </div>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={isDeleting}
          data-testid={`button-delete-${expense.id}`}
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-white/5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all duration-200 z-20"
          title="Delete expense"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
