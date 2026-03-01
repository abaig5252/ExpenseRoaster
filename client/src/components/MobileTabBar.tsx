import { Link, useLocation } from "wouter";
import { Flame, Wallet, BarChart3, FileText, Settings } from "lucide-react";
import { useMe } from "@/hooks/use-subscription";

const tabs = [
  { href: "/upload", label: "Roast", icon: Flame },
  { href: "/bank", label: "Bank", icon: Wallet },
  { href: "/tracker", label: "Tracker", icon: BarChart3 },
  { href: "/annual-report", label: "Annual", icon: FileText },
  { href: "/pricing", label: "Plans", icon: Settings },
];

export function MobileTabBar() {
  const [location] = useLocation();
  const { data: me } = useMe();
  const isPremium = me?.tier === "premium";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="bg-[#0a0a14]/95 backdrop-blur-xl border-t border-white/[0.08]">
        <div className="flex items-stretch h-16">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive = location === href;
            const isLocked = href === "/bank" && !isPremium;
            return (
              <Link key={href} href={href} className="flex-1">
                <div className={`flex flex-col items-center justify-center h-full gap-1 transition-all duration-150 relative ${
                  isActive ? "text-[hsl(var(--primary))]" : "text-white/40"
                }`}>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[hsl(var(--primary))] block" />
                  )}
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                  {isLocked && (
                    <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 rounded-full bg-[hsl(var(--primary))]/60" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
