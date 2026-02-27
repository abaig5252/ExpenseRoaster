import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useUploadExpense } from "@/hooks/use-expenses";
import type { ExpenseResponse } from "@shared/routes";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [result, setResult] = useState<ExpenseResponse | null>(null);
  const uploadMutation = useUploadExpense();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      const reader = new FileReader();
      reader.onload = () => {
        setBase64Image(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
  });

  const handleUpload = () => {
    if (!base64Image) return;
    uploadMutation.mutate(
      { image: base64Image },
      {
        onSuccess: (data) => {
          setResult(data);
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

  const loadingMessages = [
    "Analyzing your poor life choices...",
    "Judging your financial decisions...",
    "Extracting evidence of your spending...",
    "Calculating the damage...",
  ];
  const loadingText = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={resetAndClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-lg rounded-[2rem] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl shadow-[hsl(var(--primary))]/20 relative"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center relative z-10 bg-black/20">
                <h2 className="text-2xl font-display font-bold text-foreground">
                  {result ? "The Verdict is In" : "Upload Receipt"}
                </h2>
                <button
                  onClick={resetAndClose}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto relative z-10">
                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-16 h-16 text-[hsl(var(--primary))] animate-spin mb-6" />
                    <p className="text-lg font-medium text-foreground text-center animate-pulse">
                      {loadingText}
                    </p>
                  </div>
                ) : result ? (
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-20 h-20 bg-[hsl(var(--secondary))]/20 rounded-full flex items-center justify-center border-2 border-[hsl(var(--secondary))]">
                      <Sparkles className="w-10 h-10 text-[hsl(var(--secondary))]" />
                    </div>
                    
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                        Financial Damage
                      </div>
                      <div className="text-6xl font-display font-bold text-foreground">
                        {(result.amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </div>
                      <div className="text-lg text-foreground/80 mt-2">
                        {result.description}
                      </div>
                    </div>

                    <div className="bg-[hsl(var(--primary))]/10 border-2 border-[hsl(var(--primary))]/30 rounded-3xl p-6 w-full relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[hsl(var(--primary))]" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--primary))] mb-3">
                        The Roast
                      </h3>
                      <p className="text-xl font-body italic text-foreground leading-relaxed">
                        "{result.roast}"
                      </p>
                    </div>

                    <button
                      onClick={resetAndClose}
                      className="w-full py-4 rounded-2xl font-bold text-lg bg-white text-black hover:bg-white/90 transition-colors shadow-lg"
                    >
                      I Accept My Shame
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {uploadMutation.isError && (
                      <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-start gap-3 text-destructive">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{uploadMutation.error.message}</p>
                      </div>
                    )}

                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                        isDragActive
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                          : preview
                          ? "border-white/20 bg-white/5"
                          : "border-white/10 hover:border-white/30 hover:bg-white/5"
                      }`}
                    >
                      <input {...getInputProps()} />
                      
                      {preview ? (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg">
                          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <p className="font-bold text-white">Click or drag to change</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <UploadCloud className="w-10 h-10 text-muted-foreground" />
                          </div>
                          <p className="text-xl font-bold text-foreground mb-2">
                            Drag & drop a receipt here
                          </p>
                          <p className="text-muted-foreground text-sm max-w-[250px]">
                            Or click to browse from your device. We accept JPG, PNG, and WebP.
                          </p>
                        </>
                      )}
                    </div>

                    {preview && (
                      <button
                        onClick={handleUpload}
                        className="w-full py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] text-white hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary))]/30 flex items-center justify-center gap-2"
                      >
                        <Flame className="w-5 h-5" />
                        Roast My Purchase
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
