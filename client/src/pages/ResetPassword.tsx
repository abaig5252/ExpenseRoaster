import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setValid(false); return; }
    fetch(`/api/auth/local/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => setValid(d.valid))
      .catch(() => setValid(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/local/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Reset failed"); return; }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[hsl(var(--primary))]/50 transition-colors";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <AppLogo size="sm" />
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/[0.08]">
          {valid === null && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
          )}

          {valid === false && !done && (
            <div className="text-center py-4">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-black text-white mb-2">Link invalid or expired</h2>
              <p className="text-white/50 text-sm mb-6">This reset link has expired or already been used. Please request a new one.</p>
              <a href="/login" className="text-[hsl(var(--primary))] text-sm hover:opacity-80 font-semibold">Back to sign in</a>
            </div>
          )}

          {valid && !done && (
            <>
              <h2 className="text-xl font-black text-white mb-1">Set new password</h2>
              <p className="text-white/40 text-sm mb-6">Choose a strong password for your account.</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative">
                  <input data-testid="input-new-password" type={showPass ? "text" : "password"} placeholder="New password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass + " pr-12"} />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input data-testid="input-confirm-password" type={showConfirm ? "text" : "password"} placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required className={inputClass + " pr-12"} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button data-testid="button-reset-submit" type="submit" disabled={loading} className="w-full py-3 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Set New Password
                </button>
              </form>
            </>
          )}

          {done && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-[hsl(var(--secondary))] mx-auto mb-4" />
              <h2 className="text-xl font-black text-white mb-2">Password updated!</h2>
              <p className="text-white/50 text-sm mb-6">Your password has been changed. You can now sign in with your new password.</p>
              <a href="/login" className="inline-block py-2.5 px-6 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] hover:opacity-90 transition-opacity">
                Sign In
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
