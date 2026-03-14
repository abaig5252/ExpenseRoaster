import { useState } from "react";
import { AlertTriangle, Pencil, Trash2, Check } from "lucide-react";
import type { ExpenseResponse } from "@shared/routes";
import { parseReceiptDate } from "@/lib/dates";
import { ShareButton } from "@/components/ShareButton";

interface Props {
  expense: ExpenseResponse;
  index: number;
  avgAmountCents?: number;
  onDelete?: () => void;
  onEdit?: () => void;
  isDeleting?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  isExiting?: boolean;
}

function computeSeverity(amountCents: number, avgCents: number): number {
  if (avgCents <= 0) {
    const d = amountCents / 100;
    return d < 10 ? 1 : d < 50 ? 2 : d < 150 ? 3 : d < 500 ? 4 : 5;
  }
  const ratio = amountCents / avgCents;
  if (ratio < 0.25) return 1;
  if (ratio < 0.50) return 2;
  if (ratio < 0.80) return 3;
  if (ratio < 1.00) return 4;
  return 5;
}

const categoryEmoji: Record<string, string> = {
  "Food & Drink":    "🍔",
  "Groceries":       "🛒",
  "Shopping":        "🛍️",
  "Transport":       "🚗",
  "Travel":          "✈️",
  "Entertainment":   "🎬",
  "Health & Fitness":"💊",
  "Health":          "💊",
  "Subscriptions":   "📱",
  "Coffee":          "☕",
  "Other":           "🧾",
};

const categoryPillColors: Record<string, string> = {
  "Food & Drink":    "#E85D26",
  "Groceries":       "#78A856",
  "Shopping":        "#C4A832",
  "Transport":       "#3BB8A0",
  "Travel":          "#3B8EB8",
  "Entertainment":   "#E8526A",
  "Health & Fitness":"#5BA85E",
  "Health":          "#5BA85E",
  "Subscriptions":   "#7B6FE8",
  "Coffee":          "#C4A832",
  "Other":           "#4A5060",
};

const ROTATIONS = [-2, 1, -1.5, 2, -0.5, 1.5, -1, 0.5, -2.5, 0];

export function ReceiptCollageCard({
  expense, index, avgAmountCents = 0, onDelete, onEdit, isDeleting,
  isSelectMode = false, isSelected = false, onSelect, isExiting = false,
}: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hovered, setHovered] = useState(false);
  const rotation = ROTATIONS[index % ROTATIONS.length];
  const expenseCurrency = (expense as any).currency || "USD";
  const formattedAmount = (expense.amount / 100).toLocaleString(undefined, { style: "currency", currency: expenseCurrency });
  const formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parseReceiptDate(expense.date));
  const emoji = categoryEmoji[expense.category] || "🧾";
  const pillColor = categoryPillColors[expense.category] || "#4A5060";
  const severity = computeSeverity(expense.amount, avgAmountCents);

  const handleCardClick = () => {
    if (isSelectMode) onSelect?.();
  };

  return (
    <div
      data-testid={`card-receipt-${expense.id}`}
      onClick={handleCardClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      style={{
        background: "#1A1A1A",
        border: isSelected
          ? "2px solid #00E676"
          : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18,
        padding: "18px 16px 14px",
        position: "relative",
        breakInside: "avoid",
        marginBottom: 16,
        transform: isExiting
          ? "scale(0.88)"
          : isSelectMode
            ? "rotate(0deg)"
            : hovered && !showDeleteConfirm
              ? "rotate(0deg) scale(1.025)"
              : `rotate(${rotation}deg)`,
        opacity: isExiting ? 0 : 1,
        transition: isExiting
          ? "transform 0.3s ease, opacity 0.3s ease"
          : "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s, border-color 0.15s",
        boxShadow: isSelected
          ? "0 0 0 1px #00E676, 0 4px 24px rgba(0,230,118,0.15)"
          : hovered
            ? "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,230,118,0.12)"
            : "0 4px 16px rgba(0,0,0,0.3)",
        cursor: isSelectMode ? "pointer" : "default",
      }}
    >
      {/* Checkbox overlay — shown in select mode */}
      {isSelectMode && (
        <div
          onClick={e => { e.stopPropagation(); onSelect?.(); }}
          data-testid={`checkbox-select-${expense.id}`}
          style={{
            position: "absolute", top: 10, left: 10, zIndex: 10,
            width: 22, height: 22, borderRadius: "50%",
            border: isSelected ? "none" : "2px solid rgba(255,255,255,0.3)",
            background: isSelected ? "#00E676" : "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.15s, border 0.15s",
            boxShadow: isSelected ? "0 0 8px rgba(0,230,118,0.5)" : undefined,
          }}
        >
          {isSelected && <Check style={{ width: 13, height: 13, color: "#000", strokeWidth: 3 }} />}
        </div>
      )}

      {/* Edit button — top left, hidden in select mode */}
      {!isSelectMode && onEdit && (
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          data-testid={`button-edit-receipt-${expense.id}`}
          title="Edit receipt"
          style={{
            position: "absolute", top: 9, left: 9, zIndex: 10,
            width: 26, height: 26, borderRadius: 8,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
          onMouseOut={e => (e.currentTarget.style.background = "rgba(0,0,0,0.4)")}
        >
          <Pencil style={{ width: 12, height: 12, color: "rgba(255,255,255,0.6)" }} />
        </button>
      )}

      {/* Delete button — top right, hidden in select mode */}
      {!isSelectMode && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }}
          data-testid={`button-delete-receipt-${expense.id}`}
          title="Delete receipt"
          style={{
            position: "absolute", top: 9, right: 9, zIndex: 10,
            width: 26, height: 26, borderRadius: 8,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
          onMouseOut={e => (e.currentTarget.style.background = "rgba(0,0,0,0.4)")}
        >
          <Trash2 style={{ width: 12, height: 12, color: "rgba(255,255,255,0.6)" }} />
        </button>
      )}

      {/* Emoji + amount */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>{emoji}</span>
        <div style={{
          fontFamily: "'Cabinet Grotesk', sans-serif",
          fontWeight: 800, fontSize: 28,
          color: "#FFFFFF", letterSpacing: "-1px", lineHeight: 1,
        }}>
          {formattedAmount}
        </div>
      </div>

      {/* Description + meta */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <p style={{
          fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700,
          fontSize: 13, color: "#FFFFFF",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          margin: "0 0 6px",
        }}>
          {expense.description}
        </p>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 800,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: "#FFFFFF", background: pillColor,
            padding: "2px 7px", borderRadius: 5,
          }}>
            {expense.category}
          </span>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#4A5060" }}>
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Roast */}
      {expense.roast && (
        <div style={{
          background: "rgba(0,230,118,0.06)",
          border: "1px solid rgba(0,230,118,0.18)",
          borderRadius: 10, padding: "10px 12px",
          marginBottom: 10,
        }}>
          <p style={{
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontStyle: "italic", fontWeight: 500,
            fontSize: 12, color: "#69FF9C",
            lineHeight: 1.65, margin: 0,
          }}>
            "{expense.roast}"
          </p>
        </div>
      )}

      {/* Severity + share */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} style={{ fontSize: 11, opacity: n <= severity ? 1 : 0.15 }}>🔥</span>
        ))}
        {expense.roast && (
          <div style={{ marginLeft: 6 }}>
            <ShareButton
              text={`🔥 "${expense.roast}"\n\n— ${(expense.amount / 100).toLocaleString(undefined, { style: "currency", currency: (expense as any).currency || "USD" })} at ${expense.description} · Expense Roaster`}
              variant="icon"
              className="flex items-center justify-center w-6 h-6 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-all duration-200"
            />
          </div>
        )}
      </div>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", inset: 0, borderRadius: 18,
            background: "rgba(18,18,18,0.97)", backdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 20, gap: 12,
            animation: "slideUp 0.18s ease both",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,82,82,0.12)", border: "1px solid rgba(255,82,82,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <AlertTriangle style={{ width: 18, height: 18, color: "#FF5252" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800,
              fontSize: 14, color: "#FFFFFF", margin: "0 0 5px",
            }}>
              Delete this receipt?
            </p>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              color: "#8A9099", margin: 0, lineHeight: 1.5,
            }}>
              This cannot be undone.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              data-testid={`button-collage-cancel-${expense.id}`}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                color: "#8A9099", fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600, fontSize: 12, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}
              disabled={isDeleting}
              data-testid={`button-collage-confirm-${expense.id}`}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                background: isDeleting ? "rgba(255,82,82,0.1)" : "#FF5252",
                color: isDeleting ? "#FF5252" : "#FFFFFF",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12,
                cursor: isDeleting ? "not-allowed" : "pointer",
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
