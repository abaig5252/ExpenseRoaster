import { Link, useLocation } from "wouter";
import { Flame, UploadCloud, Wallet, BarChart3, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navLinks = [
  { href: "/upload", label: "Roast Receipt", icon: Flame },
  { href: "/bank", label: "Bank Statement", icon: Wallet },
  { href: "/tracker", label: "Monthly Tracker", icon: BarChart3 },
];

export function AppNav() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const initials = user
    ? ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || user.email?.[0]?.toUpperCase() || "?"
    : "?";

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
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

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = location === href;
            return (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/30"
                    : "text-muted-foreground hover:text-white hover:bg-white/[0.05]"
                }`}>
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:block">{label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-xl">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="avatar" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))]/30 flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))]">
                {initials}
              </div>
            )}
            <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-[120px]">
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
