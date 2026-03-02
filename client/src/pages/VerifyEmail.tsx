import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-subscription";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Flame, Mail, CheckCircle, RefreshCw } from "lucide-react";

function TurnstileWidget({ onSuccess }: { onSuccess: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

    function render() {
      if (ref.current && (window as any).turnstile && widgetId.current === null) {
        widgetId.current = (window as any).turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onSuccess(token),
          theme: "dark",
        });
      }
    }

    if ((window as any).turnstile) {
      render();
    } else {
      const timer = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(timer);
          render();
        }
      }, 200);
      return () => clearInterval(timer);
    }

    return () => {
      if (widgetId.current !== null && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, []);

  return <div ref={ref} />;
}

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: me, isLoading: meLoading } = useMe();

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (authLoading || meLoading) return;
    if (!isAuthenticated) { window.location.href = "/api/login"; return; }
    if (me && me.emailVerified !== false) navigate("/upload");
  }, [authLoading, meLoading, isAuthenticated, me]);

  async function sendCode() {
    if (!captchaToken) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/auth/send-verification", { captchaToken });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to send code");
        return;
      }
      setCodeSent(true);
    } catch {
      setError("Network error — try again");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-email", { code });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Invalid code");
        return;
      }
      setVerified(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setTimeout(() => navigate("/upload"), 1500);
    } catch {
      setError("Network error — try again");
    } finally {
      setVerifying(false);
    }
  }

  if (authLoading || meLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0A" }}>
        <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-[#00E676] animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: "#0A0A0A" }}>
      <div style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ background: "rgba(0,230,118,0.12)", border: "1px solid rgba(0,230,118,0.22)", borderRadius: 12, padding: 10, display: "flex" }}>
            <Flame style={{ width: 20, height: 20, color: "#00E676" }} />
          </div>
          <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: 18, color: "#FFFFFF" }}>
            RoastMyWallet
          </span>
        </div>

        {verified ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <CheckCircle style={{ width: 56, height: 56, color: "#00E676", margin: "0 auto 16px" }} />
            <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: 22, color: "#FFFFFF", margin: "0 0 8px" }}>
              You're verified!
            </h2>
            <p style={{ color: "#8A9099", fontSize: 14, margin: 0 }}>Redirecting to your dashboard…</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: 22, color: "#FFFFFF", margin: "0 0 8px" }}>
              Verify your email
            </h2>
            <p style={{ color: "#8A9099", fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>
              We'll send a 6-digit code to{" "}
              <strong style={{ color: "#F0F0F0" }}>{me?.email ?? "your email"}</strong> to confirm it's you.
            </p>

            {!codeSent ? (
              <>
                {/* CAPTCHA */}
                <div style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 16px", marginBottom: 20, minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TurnstileWidget onSuccess={(token) => setCaptchaToken(token)} />
                </div>

                {!captchaToken && (
                  <p style={{ color: "#4A5060", fontSize: 12, textAlign: "center", marginBottom: 16 }}>
                    Complete the security check above to continue
                  </p>
                )}

                {error && <p style={{ color: "#FF5252", fontSize: 13, marginBottom: 12 }}>{error}</p>}

                <button
                  onClick={sendCode}
                  disabled={!captchaToken || sending}
                  data-testid="button-send-code"
                  style={{
                    width: "100%", padding: "14px", borderRadius: 14, border: "none",
                    background: captchaToken ? "#00E676" : "rgba(255,255,255,0.08)",
                    color: captchaToken ? "#002A14" : "#4A5060",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
                    cursor: captchaToken ? "pointer" : "not-allowed",
                    transition: "background 0.2s, color 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {sending
                    ? <><RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" /> Sending…</>
                    : <><Mail style={{ width: 16, height: 16 }} /> Send verification code</>
                  }
                </button>
              </>
            ) : (
              <>
                <div style={{ background: "rgba(0,230,118,0.06)", border: "1px solid rgba(0,230,118,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#69FF9C", lineHeight: 1.5 }}>
                  📬 Code sent to <strong>{me?.email}</strong>. Check your inbox (and spam folder).
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }}
                  data-testid="input-verification-code"
                  style={{
                    width: "100%", padding: "16px", borderRadius: 14,
                    border: `1px solid ${error ? "rgba(255,82,82,0.4)" : "rgba(0,230,118,0.22)"}`,
                    background: "#242424", color: "#FFFFFF",
                    fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: 30,
                    letterSpacing: "0.25em", textAlign: "center",
                    outline: "none", marginBottom: 12, boxSizing: "border-box",
                  }}
                />

                {error && <p style={{ color: "#FF5252", fontSize: 13, marginBottom: 12 }}>{error}</p>}

                <button
                  onClick={verifyCode}
                  disabled={code.length !== 6 || verifying}
                  data-testid="button-verify-code"
                  style={{
                    width: "100%", padding: "14px", borderRadius: 14, border: "none",
                    background: code.length === 6 ? "#00E676" : "rgba(255,255,255,0.08)",
                    color: code.length === 6 ? "#002A14" : "#4A5060",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
                    cursor: code.length === 6 ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "background 0.2s, color 0.2s", marginBottom: 12,
                  }}
                >
                  {verifying
                    ? <><RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" /> Verifying…</>
                    : "Verify code"
                  }
                </button>

                <button
                  onClick={() => { setCodeSent(false); setCaptchaToken(null); setCode(""); setError(null); }}
                  style={{ background: "none", border: "none", color: "#4A5060", fontSize: 13, cursor: "pointer", width: "100%", textAlign: "center", padding: "8px" }}
                >
                  Didn't receive it? Start over
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
