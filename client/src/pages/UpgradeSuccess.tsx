import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Flame, CheckCircle2 } from "lucide-react";
import { useFulfill } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";

export default function UpgradeSuccess() {
  const [, navigate] = useLocation();
  const fulfillMutation = useFulfill();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      navigate("/pricing");
      return;
    }

    fulfillMutation.mutate(sessionId, {
      onSuccess: (data) => {
        const tier = data.user?.tier;
        const hasReport = data.user?.hasAnnualReport;
        toast({ title: "Payment confirmed!", description: tier === "premium" ? "Welcome to Premium 🔥" : "Your Annual Report is ready!" });
        setTimeout(() => {
          if (hasReport && tier === "free") navigate("/annual-report");
          else navigate("/upload");
        }, 2000);
      },
      onError: () => {
        toast({ title: "Something went wrong", description: "Please contact support.", variant: "destructive" });
        setTimeout(() => navigate("/pricing"), 2000);
      },
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-noise" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <div className="w-20 h-20 rounded-full bg-[hsl(var(--primary))]/20 border border-[hsl(var(--primary))]/30 flex items-center justify-center mx-auto mb-6">
          {fulfillMutation.isPending ? (
            <Flame className="w-10 h-10 text-[hsl(var(--primary))] animate-pulse" />
          ) : (
            <CheckCircle2 className="w-10 h-10 text-[hsl(var(--secondary))]" />
          )}
        </div>
        <h1 className="text-4xl font-display font-black text-white mb-3">
          {fulfillMutation.isPending ? "Confirming payment..." : "You're in!"}
        </h1>
        <p className="text-muted-foreground text-lg">
          {fulfillMutation.isPending ? "Hold tight, activating your account..." : "Redirecting you now..."}
        </p>
      </motion.div>
    </div>
  );
}
