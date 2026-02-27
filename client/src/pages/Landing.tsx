import { motion } from "framer-motion";
import { Flame, TrendingDown, BadgeDollarSign, BarChart3, Sparkles, ChevronRight, Receipt, Wallet } from "lucide-react";

export default function Landing() {
  const features = [
    { icon: Receipt, title: "AI Receipt Scanning", desc: "Snap your receipt, get roasted in seconds. No spreadsheets, no excuses." },
    { icon: Flame, title: "Spicy Roasts", desc: "Our AI will drag your spending habits in the most hilarious, accurate way possible." },
    { icon: BarChart3, title: "Monthly Tracker", desc: "Watch your financial crimes stack up month by month with beautiful charts." },
    { icon: Wallet, title: "Bank Statement Analysis", desc: "Upload your full bank statement for a comprehensive roasting of your entire lifestyle." },
    { icon: TrendingDown, title: "Financial Advice", desc: "Get real, actionable tips to stop the bleeding. Brutally honest, never boring." },
    { icon: BadgeDollarSign, title: "Spending Insights", desc: "Understand exactly which habits are draining your bank account the fastest." },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="bg-noise" />

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-16 pb-32">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[hsl(var(--primary))] opacity-[0.06] blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-[hsl(var(--secondary))] opacity-[0.05] blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative z-10 max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel mb-8 border-[hsl(var(--primary))]/30">
            <Flame className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span className="text-sm font-semibold text-[hsl(var(--primary))] uppercase tracking-widest">
              The World's Most Judgmental Finance App
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl md:text-8xl font-display font-black leading-[0.9] mb-8">
            <span className="text-gradient-primary">RoastMyWallet</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
            Upload your receipts and bank statements. Get <span className="text-white font-semibold">brutally honest AI roasts</span> about your spending habits — and actually useful financial advice.
          </p>
          <p className="text-base text-muted-foreground/70 mb-12">
            Because your wallet needs a reality check, and your friends are too polite to give it.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.a
              href="/api/login"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group relative px-10 py-5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] rounded-2xl font-display font-bold text-xl text-white btn-glow transition-all duration-300 flex items-center gap-3"
              data-testid="button-get-started"
            >
              <Flame className="w-6 h-6" />
              <span>Get Roasted — It's Free</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.a>
          </div>
        </motion.div>

        {/* Floating receipt card mockup */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
          className="relative z-10 mt-20 w-full max-w-sm mx-auto animate-float"
        >
          <div className="glass-panel rounded-3xl p-6 text-left border border-[hsl(var(--primary))]/20">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-[hsl(var(--primary))]/20 rounded-xl p-3">
                <Receipt className="w-6 h-6 text-[hsl(var(--primary))]" />
              </div>
              <span className="text-3xl font-display font-black text-white">$87.50</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Fancy Coffee x 5</h3>
            <p className="text-xs text-muted-foreground mb-4">Food & Drink · This week</p>
            <div className="bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/30 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <Flame className="w-4 h-4 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                <p className="text-sm italic text-white/90">"$87.50 on coffee this week? Your barista is going to Bali. You're going nowhere."</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-black mb-4">
              Everything you need to face <span className="text-gradient-primary">financial reality</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              We track it. We roast it. We help you fix it. (Or at least laugh about it.)
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel glass-panel-hover rounded-3xl p-6"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--secondary))]/20 flex items-center justify-center mb-4 border border-white/10">
                  <f.icon className="w-6 h-6 text-[hsl(var(--primary))]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto glass-panel rounded-[2.5rem] p-12 border border-[hsl(var(--primary))]/20"
        >
          <Sparkles className="w-12 h-12 text-[hsl(var(--accent))] mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-display font-black mb-4">
            Ready to get <span className="text-gradient-primary">financially roasted?</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of people who've discovered their spending sins and (sometimes) fixed them.
          </p>
          <a
            href="/api/login"
            className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] rounded-2xl font-display font-bold text-xl text-white btn-glow transition-all duration-300"
            data-testid="button-cta-login"
          >
            <Flame className="w-6 h-6" />
            Start My Roast Session
          </a>
        </motion.div>
      </section>

      <footer className="py-8 text-center text-muted-foreground text-sm border-t border-white/5">
        <p>RoastMyWallet &copy; 2026 — Your wallet's worst nightmare, your finances' best friend.</p>
      </footer>
    </div>
  );
}
