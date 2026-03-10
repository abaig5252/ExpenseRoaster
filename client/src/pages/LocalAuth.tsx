import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { useQueryClient } from "@tanstack/react-query";

type View = "login" | "register" | "forgot" | "forgot-sent";

function setLocalAuthCookie(token: string) {
  const maxAge = 30 * 24 * 60 * 60;
  document.cookie = `er_local_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export default function LocalAuth() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("login");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");

  const reset = () => { setError(""); };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Login failed"); return; }
      setLocalAuthCookie(data.token);
      await queryClient.invalidateQueries();
      navigate(data.user.onboardingComplete ? "/upload" : "/onboarding");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/local/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Registration failed"); return; }
      setLocalAuthCookie(data.token);
      await queryClient.invalidateQueries();
      navigate("/onboarding");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      await fetch("/api/auth/local/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setView("forgot-sent");
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
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <AppLogo size="sm" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/[0.08]">
          {view === "login" && (
            <>
              <h2 className="text-xl font-black text-white mb-1">Sign in</h2>
              <p className="text-white/40 text-sm mb-6">Enter your email and password to continue.</p>
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <input data-testid="input-login-email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
                <div className="relative">
                  <input data-testid="input-login-password" type={showPass ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass + " pr-12"} />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button type="button" onClick={() => { reset(); setView("forgot"); }} className="text-xs text-[hsl(var(--primary))] hover:opacity-80 text-right -mt-1">
                  Forgot password?
                </button>
                <button data-testid="button-login-submit" type="submit" disabled={loading} className="w-full py-3 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign In
                </button>
              </form>
              <p className="mt-5 text-center text-white/40 text-xs">
                Don't have an account?{" "}
                <button onClick={() => { reset(); setView("register"); }} className="text-[hsl(var(--primary))] hover:opacity-80 font-semibold">Create one</button>
              </p>
            </>
          )}

          {view === "register" && (
            <>
              <h2 className="text-xl font-black text-white mb-1">Create account</h2>
              <p className="text-white/40 text-sm mb-6">Join Expense Roaster and face your financial reality.</p>
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <input data-testid="input-register-firstname" type="text" placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} required className={inputClass} />
                <input data-testid="input-register-email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
                <div className="relative">
                  <input data-testid="input-register-password" type={showPass ? "text" : "password"} placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass + " pr-12"} />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input data-testid="input-register-confirm" type={showConfirm ? "text" : "password"} placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={inputClass + " pr-12"} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button data-testid="button-register-submit" type="submit" disabled={loading} className="w-full py-3 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Account
                </button>
              </form>
              <p className="mt-5 text-center text-white/40 text-xs">
                Already have an account?{" "}
                <button onClick={() => { reset(); setView("login"); }} className="text-[hsl(var(--primary))] hover:opacity-80 font-semibold">Sign in</button>
              </p>
            </>
          )}

          {view === "forgot" && (
            <>
              <button onClick={() => { reset(); setView("login"); }} className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs mb-5 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
              <h2 className="text-xl font-black text-white mb-1">Reset password</h2>
              <p className="text-white/40 text-sm mb-6">Enter the email address on your account and we'll send a reset link.</p>
              <form onSubmit={handleForgot} className="flex flex-col gap-4">
                <input data-testid="input-forgot-email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button data-testid="button-forgot-submit" type="submit" disabled={loading} className="w-full py-3 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Reset Link
                </button>
              </form>
            </>
          )}

          {view === "forgot-sent" && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-[hsl(var(--secondary))] mx-auto mb-4" />
              <h2 className="text-xl font-black text-white mb-2">Check your email</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                If an account with that email exists, we've sent a password reset link. It expires in 1 hour.
              </p>
              <button onClick={() => { reset(); setView("login"); }} className="text-[hsl(var(--primary))] text-sm hover:opacity-80 font-semibold">
                Back to sign in
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-white/20 text-xs">
          <Link href="/" className="hover:text-white/40 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
