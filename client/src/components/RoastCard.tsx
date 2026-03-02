import { useRef } from "react";
import { motion } from "framer-motion";
import { Flame, X, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RoastCardProps {
  expense: {
    amount: number;
    description: string;
    category: string;
    roast: string;
  };
  watermark?: boolean;
  onClose?: () => void;
}

export function RoastCard({ expense, watermark = false, onClose }: RoastCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleShare = async () => {
    const text = `😭 I just got financially roasted:\n\n"${expense.roast}"\n\n— RoastMyWallet.app`;
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Roast copied!", description: "Share your shame with the world." });
    }
  };

  return (
    <div ref={cardRef} className="relative glass-panel rounded-3xl overflow-hidden border border-[hsl(var(--primary))]/30 shadow-2xl shadow-[hsl(var(--primary))]/20">
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors z-10"
          data-testid="button-close-roast-card"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Header glow */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--secondary))] to-[hsl(var(--accent))]" />

      <div className="p-8">
        {/* Branding */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-display font-black text-white">RoastMyWallet</span>
        </div>

        {/* Expense info */}
        <div className="mb-6">
          <div className="text-5xl font-amount-card text-white mb-1">
            {(expense.amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-lg">{expense.description}</span>
            <span className="px-2 py-0.5 rounded-full bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] text-xs font-bold">
              {expense.category}
            </span>
          </div>
        </div>

        {/* The Roast */}
        <div className="bg-gradient-to-br from-[hsl(var(--destructive))]/10 to-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span className="text-xs font-black uppercase tracking-wider text-[hsl(var(--primary))]">The Verdict</span>
          </div>
          <p className="font-roast text-white text-lg leading-relaxed">
            "{expense.roast}"
          </p>
        </div>

        {/* Watermark for free tier */}
        {watermark && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              🆓 Free tier · 2 roasts/month
            </p>
            <a href="/pricing" className="text-xs text-[hsl(var(--primary))] hover:underline font-semibold">
              Upgrade for unlimited →
            </a>
          </div>
        )}

        {/* Share button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleShare}
          data-testid="button-share-roast"
          className="w-full mt-4 py-3 rounded-2xl font-display font-bold text-white bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] btn-glow flex items-center justify-center gap-2 text-sm"
        >
          <Share2 className="w-4 h-4" />
          Share My Shame
        </motion.button>
      </div>
    </div>
  );
}
