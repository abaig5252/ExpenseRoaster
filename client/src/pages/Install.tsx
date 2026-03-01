import { useState, useEffect } from "react";
import { Download, Share, ArrowDown, Smartphone, CheckCircle } from "lucide-react";
import { Link } from "wouter";

type Platform = "android" | "ios" | "desktop" | "unknown";

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  if (isIos) return "ios";
  if (isAndroid) return "android";
  if (/mobile/.test(ua)) return "unknown";
  return "desktop";
}

function isAlreadyInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as any).standalone;
}

export default function Install() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isAlreadyInstalled());

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstalling(false);
    setDeferredPrompt(null);
  };

  if (installed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--primary))] flex items-center justify-center mb-6 text-4xl">
          🔥
        </div>
        <CheckCircle className="w-12 h-12 text-[hsl(var(--secondary))] mb-4" />
        <h1 className="text-3xl font-black text-white mb-2">You're all set!</h1>
        <p className="text-white/60 mb-8">RoastMyWallet is installed on your device.</p>
        <Link href="/upload"
          className="bg-[hsl(var(--primary))] text-white font-bold px-8 py-3 rounded-2xl hover:opacity-90 transition-opacity">
          Open App
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-sm mx-auto">
      <div className="text-center mb-10">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center mb-5 mx-auto text-5xl shadow-2xl"
          style={{ boxShadow: "0 0 60px hsla(320,100%,55%,0.3)" }}>
          🔥
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Install RoastMyWallet</h1>
        <p className="text-white/50 text-sm">Add to your home screen for instant access — works like a real app, no App Store needed.</p>
      </div>

      {platform === "android" && (
        <div className="w-full space-y-4">
          {deferredPrompt ? (
            <button onClick={handleAndroidInstall} disabled={installing} data-testid="button-install-android"
              className="w-full flex items-center justify-center gap-3 bg-[hsl(var(--primary))] text-white font-bold text-lg py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-60 btn-glow">
              <Download className="w-5 h-5" />
              {installing ? "Installing…" : "Install App"}
            </button>
          ) : (
            <AndroidFallback />
          )}
        </div>
      )}

      {platform === "ios" && <IosGuide />}

      {(platform === "desktop" || platform === "unknown") && (
        <div className="w-full space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
            <Smartphone className="w-8 h-8 text-[hsl(var(--primary))] mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Open on your phone</p>
            <p className="text-white/50 text-sm">Visit this page on your iPhone or Android device to install the app.</p>
          </div>
          <div className="text-center">
            <p className="text-white/40 text-xs mb-2">Share this link with your phone</p>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm text-[hsl(var(--secondary))] select-all" data-testid="text-install-url">
              {window.location.href}
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-white/30 text-xs">
        Already using the app?{" "}
        <Link href="/upload" className="text-[hsl(var(--primary))] hover:opacity-80">
          Go to home
        </Link>
      </p>
    </div>
  );
}

function IosGuide() {
  const steps = [
    {
      icon: "safari",
      label: "Open in Safari",
      detail: "This page must be open in Safari (not Chrome or another browser).",
    },
    {
      icon: "share",
      label: 'Tap the Share button',
      detail: 'Look for the share icon at the bottom of Safari — it looks like a box with an arrow pointing up.',
      highlight: true,
    },
    {
      icon: "add",
      label: '"Add to Home Screen"',
      detail: 'Scroll down in the share sheet and tap "Add to Home Screen".',
      highlight: true,
    },
    {
      icon: "done",
      label: "Tap Add",
      detail: 'Confirm the name and tap "Add" in the top right corner.',
    },
  ];

  return (
    <div className="w-full space-y-3">
      <p className="text-center text-white/50 text-xs uppercase tracking-widest font-semibold mb-5">4 quick steps</p>
      {steps.map((step, i) => (
        <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border ${
          step.highlight
            ? "bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30"
            : "bg-white/5 border-white/10"
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-sm ${
            step.highlight ? "bg-[hsl(var(--primary))] text-white" : "bg-white/10 text-white/60"
          }`}>
            {i + 1}
          </div>
          <div>
            <p className="text-white font-bold text-sm">{step.label}</p>
            <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{step.detail}</p>
          </div>
        </div>
      ))}

      <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
        <Share className="w-5 h-5 text-[hsl(var(--secondary))] shrink-0" />
        <p className="text-white/60 text-xs leading-relaxed">
          The <span className="text-white font-semibold">Share button</span> is the square icon with an arrow at the bottom center of Safari.
        </p>
      </div>
    </div>
  );
}

function AndroidFallback() {
  return (
    <div className="w-full space-y-3">
      <p className="text-center text-white/50 text-xs uppercase tracking-widest font-semibold mb-5">Install manually</p>
      {[
        { n: 1, title: "Open Chrome menu", detail: 'Tap the three-dot menu (⋮) in the top right corner of Chrome.' },
        { n: 2, title: '"Add to Home screen"', detail: 'Tap "Add to Home screen" from the menu options.', highlight: true },
        { n: 3, title: "Confirm", detail: 'Tap "Add" in the popup to confirm.' },
      ].map(step => (
        <div key={step.n} className={`flex items-start gap-4 p-4 rounded-2xl border ${
          step.highlight
            ? "bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30"
            : "bg-white/5 border-white/10"
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-sm ${
            step.highlight ? "bg-[hsl(var(--primary))] text-white" : "bg-white/10 text-white/60"
          }`}>
            {step.n}
          </div>
          <div>
            <p className="text-white font-bold text-sm">{step.title}</p>
            <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{step.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
