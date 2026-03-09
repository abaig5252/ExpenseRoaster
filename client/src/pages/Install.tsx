import { SiApple, SiGoogleplay } from "react-icons/si";
import { Bell } from "lucide-react";
import { Link } from "wouter";

export default function Install() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-sm mx-auto">
      <div className="text-center mb-10">
        <div
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center mb-5 mx-auto text-5xl shadow-2xl"
          style={{ boxShadow: "0 0 60px hsla(320,100%,55%,0.3)" }}
        >
          🔥
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Get the App</h1>
        <p className="text-white/50 text-sm leading-relaxed">
          Expense Roaster is coming to the App Store and Google Play. Stay tuned — the native app is on its way.
        </p>
      </div>

      <div className="w-full space-y-4 mb-8">
        <div
          className="w-full flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 opacity-60 cursor-not-allowed"
          data-testid="card-app-store"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <SiApple className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-bold text-sm">Apple App Store</p>
            <p className="text-white/40 text-xs mt-0.5">iPhone &amp; iPad · Coming Soon</p>
          </div>
          <span className="text-xs font-bold text-white/30 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
            Soon
          </span>
        </div>

        <div
          className="w-full flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 opacity-60 cursor-not-allowed"
          data-testid="card-google-play"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <SiGoogleplay className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-bold text-sm">Google Play</p>
            <p className="text-white/40 text-xs mt-0.5">Android · Coming Soon</p>
          </div>
          <span className="text-xs font-bold text-white/30 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
            Soon
          </span>
        </div>
      </div>

      <div className="w-full bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/25 rounded-2xl p-5 flex items-start gap-4 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bell className="w-4 h-4 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <p className="text-white font-bold text-sm mb-0.5">Be the first to know</p>
          <p className="text-white/50 text-xs leading-relaxed">
            We'll announce launch dates on our social channels. In the meantime, the web app works great on mobile — just open it in your browser.
          </p>
        </div>
      </div>

      <p className="text-center text-white/30 text-xs">
        Using the web app?{" "}
        <Link href="/upload" className="text-[hsl(var(--primary))] hover:opacity-80">
          Go to home
        </Link>
      </p>
    </div>
  );
}
