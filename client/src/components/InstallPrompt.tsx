import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Link } from "wouter";

function isAlreadyInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as any).standalone;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isAlreadyInstalled()) return;
    if (sessionStorage.getItem("install-prompt-dismissed")) return;

    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(ua);
    if (!isMobile) return;

    const timer = setTimeout(() => setShow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("install-prompt-dismissed", "1");
  };

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 md:hidden animate-in slide-in-from-bottom-4">
      <div className="bg-[#1a1030]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center shrink-0 text-xl">
          🔥
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">Add to Home Screen</p>
          <p className="text-xs text-white/45 mt-0.5">Get the full app experience</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href="/install" onClick={dismiss}>
            <div className="flex items-center gap-1.5 bg-[hsl(var(--primary))]/20 border border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] text-xs font-bold px-3 py-2 rounded-xl hover:bg-[hsl(var(--primary))]/30 transition-colors cursor-pointer"
              data-testid="button-install-prompt">
              <Download className="w-3.5 h-3.5" />
              Install
            </div>
          </Link>
          <button onClick={dismiss} className="p-1.5 text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
