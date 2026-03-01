import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [iosPromptShown, setIosPromptShown] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) &&
      !(navigator.userAgent as any).standalone;
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone;

    if (ios && !isInStandaloneMode) setIsIos(true);

    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed) return null;
  if (!prompt && !isIos) return null;

  const handleInstall = async () => {
    if (isIos) {
      setIosPromptShown(true);
      return;
    }
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setPrompt(null);
  };

  return (
    <div className="fixed top-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80 animate-in slide-in-from-top-2">
      {iosPromptShown ? (
        <div className="bg-[#1a1030] border border-white/10 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-bold text-white">Install on iPhone</p>
            <button onClick={() => setDismissed(true)} className="text-white/40 hover:text-white p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Tap the <span className="font-bold text-white">Share</span> button in Safari, then tap <span className="font-bold text-white">"Add to Home Screen"</span> to install RoastMyWallet as an app.
          </p>
          <div className="mt-3 flex justify-center">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white/50">
              Share → Add to Home Screen
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#1a1030] border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center shrink-0 text-lg">
            🔥
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Install RoastMyWallet</p>
            <p className="text-xs text-white/50">Add to home screen for the full app experience</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleInstall}
              className="flex items-center gap-1.5 bg-[hsl(var(--primary))]/20 border border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[hsl(var(--primary))]/30 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
            <button onClick={() => setDismissed(true)} className="p-1.5 text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
