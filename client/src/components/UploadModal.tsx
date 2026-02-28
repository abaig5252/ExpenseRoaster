import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X, Loader2, Flame, AlertCircle, Camera, ChevronDown } from "lucide-react";
import { useUploadExpense } from "@/hooks/use-expenses";
import { useMe } from "@/hooks/use-subscription";
import { Link } from "wouter";
import type { ExpenseResponse } from "@shared/routes";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
  isFree?: boolean;
}

const TONES = [
  { value: "savage", label: "Savage 🔥", desc: "Maximum brutality" },
  { value: "playful", label: "Playful 😄", desc: "Friendly ribbing" },
  { value: "supportive", label: "Supportive 💛", desc: "Gentle honesty" },
];

const loadingMessages = [
  "Scanning your financial crimes...",
  "Quantifying the poor choices...",
  "Consulting the judges...",
  "Calculating your shame index...",
  "Finding the most brutal angle...",
  "Preparing your intervention...",
];

export function UploadModal({ isOpen, onClose, onSuccess, isFree }: UploadModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [result, setResult] = useState<ExpenseResponse | null>(null);
  const [tone, setTone] = useState("savage");
  const [loadingMsg] = useState(() => loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
  const uploadMutation = useUploadExpense();
  const { data: me } = useMe();

  const isPremium = me?.tier === "premium";

  const [converting, setConverting] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    let file = acceptedFiles[0];
    if (!file) return;

    const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");

    if (isHeic) {
      setConverting(true);
      try {
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        file = new File([converted as Blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
      } finally {
        setConverting(false);
      }
    }

    setPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setBase64Image(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/gif": [".gif"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
    },
    maxFiles: 1,
  });

  const handleUpload = () => {
    if (!base64Image) return;
    uploadMutation.mutate(
      { image: base64Image, tone },
      {
        onSuccess: (data) => {
          setResult(data);
          if (data.ephemeral && onSuccess) onSuccess(data);
        },
      }
    );
  };

  const resetAndClose = () => {
    setPreview(null);
    setBase64Image(null);
    setResult(null);
    uploadMutation.reset();
    onClose();
  };

  const isLimitError = (uploadMutation.error as any)?.message?.includes("limit reached") ||
    (uploadMutation as any)?.error?.message?.includes("UPLOAD_LIMIT");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-lg rounded-[2rem] overflow-hidden flex flex-col max-h-[90vh] border border-white/10 shadow-2xl shadow-[hsl(var(--primary))]/20"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[hsl(var(--primary))]/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-[hsl(var(--primary))]" />
                </div>
                <h2 className="text-xl font-display font-bold text-white">
                  {result ? "Verdict Delivered" : "Upload & Get Roasted"}
                </h2>
              </div>
              <button onClick={resetAndClose} data-testid="button-close-modal" className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto">
              {converting ? (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-[hsl(var(--secondary))]/20 border-t-[hsl(var(--secondary))] animate-spin" />
                    <Camera className="w-8 h-8 text-[hsl(var(--secondary))] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-lg font-semibold text-white text-center animate-pulse">Converting iPhone photo...</p>
                  <p className="text-sm text-muted-foreground text-center">Just a moment, preparing your image.</p>
                </div>
              ) : uploadMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-[hsl(var(--primary))]/20 border-t-[hsl(var(--primary))] animate-spin" />
                    <Flame className="w-8 h-8 text-[hsl(var(--primary))] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-lg font-semibold text-white text-center animate-pulse">{loadingMsg}</p>
                  <p className="text-sm text-muted-foreground text-center">The judges are deliberating...</p>
                </div>
              ) : result ? (
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-full bg-gradient-to-br from-[hsl(var(--primary))]/10 to-[hsl(var(--secondary))]/10 rounded-3xl p-6 border border-[hsl(var(--primary))]/20">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Financial Damage</div>
                    <div className="text-5xl font-display font-black text-white mb-2">
                      {(result.amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                    </div>
                    <div className="text-base text-muted-foreground">{result.description}</div>
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] rounded-full text-xs font-bold uppercase tracking-wider mt-2">
                      {result.category}
                    </div>
                  </div>

                  <div className="w-full bg-[hsl(var(--destructive))]/10 border-2 border-[hsl(var(--destructive))]/30 rounded-3xl p-6 relative">
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-[hsl(var(--destructive))] rounded-full flex items-center gap-1">
                      <Flame className="w-3 h-3 text-white" />
                      <span className="text-xs font-black text-white uppercase tracking-wider">The Roast</span>
                    </div>
                    <p className="text-lg font-semibold italic text-white leading-relaxed mt-2">"{result.roast}"</p>
                  </div>

                  {isFree && (
                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Free tier: your roast won't be saved.</p>
                      <Link href="/pricing">
                        <span className="text-sm text-[hsl(var(--primary))] hover:underline font-semibold cursor-pointer">
                          Upgrade to save history & get unlimited uploads →
                        </span>
                      </Link>
                    </div>
                  )}

                  <button
                    onClick={resetAndClose}
                    data-testid="button-accept-roast"
                    className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white btn-glow transition-all"
                  >
                    I Accept My Financial Shame
                  </button>
                  <button onClick={() => { setResult(null); setPreview(null); setBase64Image(null); uploadMutation.reset(); }} className="text-sm text-muted-foreground hover:text-white transition-colors">
                    Upload Another Receipt
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {uploadMutation.isError && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex flex-col gap-2 text-destructive">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{(uploadMutation.error as any)?.message}</p>
                      </div>
                      {isLimitError && (
                        <Link href="/pricing" onClick={resetAndClose}>
                          <span className="text-sm font-bold text-[hsl(var(--primary))] hover:underline cursor-pointer ml-8">
                            Upgrade to Premium for unlimited uploads →
                          </span>
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Tone selector (premium only) */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Roast Tone {!isPremium && <span className="text-[hsl(var(--primary))]">(Premium)</span>}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {TONES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          disabled={!isPremium}
                          onClick={() => isPremium && setTone(t.value)}
                          data-testid={`button-tone-${t.value}`}
                          className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all text-center ${
                            tone === t.value && isPremium
                              ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/40"
                              : isPremium
                              ? "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"
                              : "bg-white/3 text-muted-foreground/40 border border-transparent cursor-not-allowed"
                          }`}
                        >
                          <div>{t.label}</div>
                          <div className="text-xs font-normal opacity-70">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                    {!isPremium && (
                      <Link href="/pricing" onClick={resetAndClose}>
                        <p className="text-xs text-[hsl(var(--primary))] mt-1.5 hover:underline cursor-pointer">
                          Unlock tone selection with Premium →
                        </p>
                      </Link>
                    )}
                  </div>

                  <div
                    {...getRootProps()}
                    data-testid="dropzone-receipt"
                    className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                      isDragActive
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 scale-[1.01]"
                        : preview
                        ? "border-white/20 bg-white/5"
                        : "border-white/10 hover:border-[hsl(var(--primary))]/40 hover:bg-white/[0.02]"
                    }`}
                  >
                    <input {...getInputProps()} data-testid="input-file" />
                    {preview ? (
                      <div className="relative w-full rounded-2xl overflow-hidden shadow-lg">
                        <img src={preview} alt="Preview" className="w-full max-h-64 object-contain" />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <p className="font-bold text-white flex items-center gap-2"><Camera className="w-5 h-5" /> Change image</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                          <UploadCloud className="w-9 h-9 text-muted-foreground" />
                        </div>
                        <p className="text-xl font-bold text-white mb-2">Drop your receipt here</p>
                        <p className="text-sm text-muted-foreground max-w-[260px]">
                          JPG, PNG, WebP, GIF, or HEIC — all formats accepted, including iPhone photos.
                          {isFree && <span className="block mt-1 text-[hsl(var(--primary))]">{Math.max(0, 1 - (me?.monthlyUploadCount || 0))} upload remaining this month.</span>}
                        </p>
                      </>
                    )}
                  </div>

                  {preview && (
                    <button
                      onClick={handleUpload}
                      data-testid="button-roast-purchase"
                      className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white btn-glow transition-all flex items-center justify-center gap-3"
                    >
                      <Flame className="w-5 h-5" />
                      Roast This Purchase
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
