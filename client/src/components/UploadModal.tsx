import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X, Flame, AlertCircle, Camera, Check, ChevronLeft, ScanLine } from "lucide-react";
import { usePreviewReceipt, useConfirmReceipt } from "@/hooks/use-expenses";
import { useMe } from "@/hooks/use-subscription";
import { useCurrency } from "@/hooks/use-currency";
import { Link } from "wouter";
import { VERDICT_CATEGORY_COLORS } from "@/lib/verdict";
import type { ExpenseResponse } from "@shared/routes";
import type { PreviewData } from "@/hooks/use-expenses";

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

const CATEGORIES = [
  "Food & Drink", "Groceries", "Shopping", "Transport",
  "Travel", "Entertainment", "Health & Fitness", "Subscriptions", "Other",
];

const analysingMessages = [
  "Scanning your financial crimes...",
  "Quantifying the poor choices...",
  "Consulting the judges...",
  "Calculating your shame index...",
  "Finding the most brutal angle...",
  "Preparing your intervention...",
];

type Stage = "upload" | "preview" | "result";

export function UploadModal({ isOpen, onClose, onSuccess, isFree }: UploadModalProps) {
  const [stage, setStage] = useState<Stage>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [tone, setTone] = useState("savage");
  const [dropError, setDropError] = useState<string | null>(null);
  const [loadingMsg] = useState(() => analysingMessages[Math.floor(Math.random() * analysingMessages.length)]);

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [result, setResult] = useState<(ExpenseResponse & { ephemeral?: boolean }) | null>(null);

  const previewMutation = usePreviewReceipt();
  const confirmMutation = useConfirmReceipt();

  const { data: me } = useMe();
  const { formatAmount } = useCurrency();
  const isPremium = me?.tier === "premium";

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setDropError(null);
    const file = acceptedFiles[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setBase64Image(reader.result as string);
    reader.onerror = () => setDropError("Failed to read image file. Please try another.");
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

  const handleAnalyse = () => {
    if (!base64Image) return;
    previewMutation.mutate(
      { image: base64Image, tone },
      {
        onSuccess: (data) => {
          setPreviewData(data);
          setEditAmount((data.amount / 100).toFixed(2));
          setEditCategory(data.category);
          setStage("preview");
        },
      }
    );
  };

  const handleConfirm = () => {
    if (!previewData) return;
    const amountCents = Math.round(parseFloat(editAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    confirmMutation.mutate(
      {
        amount: amountCents,
        description: previewData.description,
        date: previewData.date,
        category: editCategory,
        roast: previewData.roast,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          setStage("result");
          if (data.ephemeral && onSuccess) onSuccess(data);
        },
      }
    );
  };

  const resetAndClose = () => {
    setStage("upload");
    setPreview(null);
    setBase64Image(null);
    setPreviewData(null);
    setEditAmount("");
    setEditCategory("");
    setResult(null);
    setDropError(null);
    previewMutation.reset();
    confirmMutation.reset();
    onClose();
  };

  const isLimitError =
    (previewMutation.error as any)?.message?.includes("limit reached") ||
    (confirmMutation.error as any)?.message?.includes("limit reached");

  const activeError = previewMutation.error || confirmMutation.error;
  const isPending = previewMutation.isPending || confirmMutation.isPending;

  const headerTitle =
    stage === "result" ? "Verdict Delivered" :
    stage === "preview" ? "Review Your Receipt" :
    "Upload & Get Roasted";

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
                {stage === "preview" && (
                  <button
                    onClick={() => { setStage("upload"); previewMutation.reset(); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors mr-1"
                    data-testid="button-preview-back"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
                <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-[hsl(var(--primary))]" />
                </div>
                <h2 className="text-xl font-bold text-white">{headerTitle}</h2>
              </div>
              <button onClick={resetAndClose} data-testid="button-close-modal" className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto">
              {isPending ? (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-[hsl(var(--primary))]/20 border-t-[hsl(var(--primary))] animate-spin" />
                    <Flame className="w-8 h-8 text-[hsl(var(--primary))] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-lg font-semibold text-white text-center animate-pulse">
                    {stage === "upload" ? loadingMsg : "Saving your receipt..."}
                  </p>
                  <p className="text-sm text-muted-foreground text-center">The judges are deliberating...</p>
                </div>

              ) : stage === "result" && result ? (
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-full bg-gradient-to-br from-[hsl(var(--primary))]/10 to-[hsl(var(--secondary))]/10 rounded-3xl p-6 border border-[hsl(var(--primary))]/20">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Financial Damage</div>
                    <div className="text-5xl font-amount-card text-white mb-2">{formatAmount(result.amount)}</div>
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
                  <button
                    onClick={() => { setStage("upload"); setPreview(null); setBase64Image(null); setResult(null); previewMutation.reset(); confirmMutation.reset(); }}
                    className="text-sm text-muted-foreground hover:text-white transition-colors"
                  >
                    Upload Another Receipt
                  </button>
                </div>

              ) : stage === "preview" && previewData ? (
                <div className="flex flex-col gap-5">
                  {activeError && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex flex-col gap-2 text-destructive">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{(activeError as any)?.message}</p>
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

                  <p className="text-sm text-muted-foreground">
                    Looks right? Edit anything that's off, then confirm.
                  </p>

                  {/* Merchant */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Merchant</label>
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-semibold">
                      {previewData.description}
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Amount</label>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-[hsl(var(--primary))]/50 transition-colors">
                      <span className="pl-4 text-[hsl(var(--primary))] font-bold text-lg select-none">
                        {previewData.currency === "GBP" ? "£" : previewData.currency === "EUR" ? "€" : "$"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        data-testid="input-preview-amount"
                        className="flex-1 bg-transparent px-3 py-3 text-2xl font-bold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {/* Category chips */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Category</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => {
                        const active = editCategory === cat;
                        const col = VERDICT_CATEGORY_COLORS[cat.toLowerCase()] ?? "#4A5060";
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setEditCategory(cat)}
                            data-testid={`button-category-${cat.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "")}`}
                            className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all"
                            style={
                              active
                                ? { backgroundColor: col + "33", borderColor: col, color: col }
                                : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }
                            }
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Roast preview */}
                  <div className="bg-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/20 rounded-2xl p-4 flex items-start gap-3">
                    <Flame className="w-4 h-4 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                    <p className="text-sm italic text-white/80 leading-relaxed">"{previewData.roast}"</p>
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handleConfirm}
                    disabled={confirmMutation.isPending}
                    data-testid="button-confirm-receipt"
                    className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white btn-glow transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                  >
                    <Check className="w-5 h-5" />
                    Confirm Upload
                  </button>
                </div>

              ) : (
                <div className="flex flex-col gap-5">
                  {dropError && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-start gap-3 text-destructive">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium">{dropError}</p>
                    </div>
                  )}
                  {previewMutation.isError && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex flex-col gap-2 text-destructive">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{(previewMutation.error as any)?.message}</p>
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

                  {/* Tone selector */}
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

                  {/* Dropzone */}
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
                          JPG, PNG, WebP, GIF, HEIC, or HEIF — all formats accepted, including iPhone photos.
                          {isFree && <span className="block mt-1 text-[hsl(var(--primary))]">{Math.max(0, 1 - (me?.monthlyUploadCount || 0))} upload remaining this month.</span>}
                        </p>
                      </>
                    )}
                  </div>

                  {preview && (
                    <button
                      onClick={handleAnalyse}
                      data-testid="button-roast-purchase"
                      className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white btn-glow transition-all flex items-center justify-center gap-3"
                    >
                      <ScanLine className="w-5 h-5" />
                      Analyse Receipt
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
