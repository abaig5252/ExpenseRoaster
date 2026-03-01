import { Link, useLocation } from "wouter";
import { Flame, Wallet, BarChart3, LogOut, Crown, FileText, Download, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-subscription";

const navLinks = [
  { href: "/upload", label: "Roast Receipt", icon: Flame },
  { href: "/bank", label: "Bank Statement", icon: Wallet },
  { href: "/tracker", label: "Monthly Tracker", icon: BarChart3 },
  { href: "/annual-report", label: "Annual Report", icon: FileText },
];

export function AppNav() {
  const { user, logout } = useAuth();
  const { data: me } = useMe();
  const [location] = useLocation();

  const isPremium = me?.tier === "premium";
  const hasAnnualReport = me?.hasAnnualReport;

  const initials = user
    ? ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || user.email?.[0]?.toUpperCase() || "?"
    : "?";

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-background/80 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/upload" data-testid="link-home">
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-black text-white text-lg hidden sm:block">RoastMyWallet</span>
          </div>
        </Link>

        {/* Nav links — hidden on mobile (bottom tab bar takes over) */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = location === href;
            const isLocked = href === "/bank" && !isPremium;
            const isAnnualLocked = href === "/annual-report" && !hasAnnualReport && !isPremium;

            return (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/30"
                    : "text-muted-foreground hover:text-white hover:bg-white/[0.05]"
                }`}>
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:block">{label}</span>
                  {(isLocked || isAnnualLocked) && <Crown className="w-3 h-3 text-[hsl(var(--primary))]/60 hidden md:block" />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* User + Tier */}
        <div className="flex items-center gap-2">
          <Link href="/contact" data-testid="link-contact">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
              <Mail className="w-3.5 h-3.5 text-white/50" />
              <span className="text-xs font-semibold text-white/50">Contact</span>
            </div>
          </Link>
          <Link href="/install" data-testid="link-install-app">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[hsl(var(--secondary))]/10 border border-[hsl(var(--secondary))]/20 cursor-pointer hover:bg-[hsl(var(--secondary))]/20 transition-colors">
              <Download className="w-3.5 h-3.5 text-[hsl(var(--secondary))]" />
              <span className="text-xs font-bold text-[hsl(var(--secondary))]">Get App</span>
            </div>
          </Link>
          {/* Tier badge */}
          {isPremium ? (
            <Link href="/pricing">
              <div data-testid="badge-premium" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))]/20 to-[hsl(var(--secondary))]/20 border border-[hsl(var(--primary))]/30 cursor-pointer hover:opacity-80 transition-opacity">
                <Crown className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                <span className="text-xs font-black text-[hsl(var(--primary))] uppercase tracking-wider">Premium</span>
              </div>
            </Link>
          ) : (
            <Link href="/pricing">
              <div data-testid="badge-free" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <span className="text-xs font-bold text-muted-foreground">Free</span>
                <span className="text-xs text-[hsl(var(--primary))] font-bold">Upgrade</span>
              </div>
            </Link>
          )}

          <div className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-xl">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="avatar" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))]/30 flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))]">
                {initials}
              </div>
            )}
            <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-[100px]">
              {user?.firstName || user?.email?.split("@")[0] || "User"}
            </span>
          </div>
          <button
            onClick={() => logout()}
            data-testid="button-logout"
            className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
