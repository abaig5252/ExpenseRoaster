import { useState, useRef, useEffect, useCallback } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { SiX, SiWhatsapp, SiFacebook } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  text: string;
  label?: string;
  variant?: "icon" | "full";
  className?: string;
}

const PLATFORMS = [
  {
    name: "Twitter / X",
    Icon: SiX,
    color: "#000",
    bg: "rgba(255,255,255,0.08)",
    url: (t: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,
  },
  {
    name: "WhatsApp",
    Icon: SiWhatsapp,
    color: "#25D366",
    bg: "rgba(37,211,102,0.08)",
    url: (t: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(t)}`,
  },
  {
    name: "Facebook",
    Icon: SiFacebook,
    color: "#1877F2",
    bg: "rgba(24,119,242,0.08)",
    url: (t: string) => `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(t)}`,
  },
];

export function ShareButton({ text, label, variant = "icon", className = "" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth = 200;
      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      setMenuPos({ top: rect.top - 8, left });
    }
    setOpen(o => !o);
  }, [text]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Paste it anywhere." });
  }, [text, toast]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleShare}
        data-testid="button-share"
        className={className}
        title="Share"
      >
        <Share2 className={variant === "full" ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {label && <span>{label}</span>}
      </button>

      {open && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            transform: "translateY(-100%)",
            zIndex: 9999,
            width: 200,
            background: "#1A1A1A",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: 8,
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          }}
        >
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
            padding: "4px 8px 8px", margin: 0,
          }}>
            Share to
          </p>
          {PLATFORMS.map(({ name, Icon, color, bg, url }) => (
            <a
              key={name}
              href={url(text)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 10, textDecoration: "none",
                background: "transparent", transition: "background 0.15s",
                cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = bg)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Icon style={{ width: 15, height: 15, color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{name}</span>
            </a>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
          <button
            onClick={handleCopy}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "9px 10px", borderRadius: 10, border: "none",
              background: "transparent", cursor: "pointer", transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {copied
              ? <Check style={{ width: 15, height: 15, color: "#00E676", flexShrink: 0 }} />
              : <Copy style={{ width: 15, height: 15, color: "rgba(255,255,255,0.5)", flexShrink: 0 }} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: copied ? "#00E676" : "#fff" }}>
              {copied ? "Copied!" : "Copy text"}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
