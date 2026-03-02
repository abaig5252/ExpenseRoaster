import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { ExpenseResponse } from "@shared/routes";

interface Props {
  expense: ExpenseResponse;
  index: number;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const categoryEmoji: Record<string, string> = {
  "Food & Drink":  "🍔",
  "Shopping":      "🛍️",
  "Transport":     "🚗",
  "Entertainment": "🎬",
  "Health":        "💊",
  "Subscriptions": "📱",
  "Coffee":        "☕",
  "Groceries":     "🛒",
  "Other":         "🧾",
};

const categoryPillColors: Record<string, string> = {
  "Food & Drink":  "#E85D26",
  "Shopping":      "#C4A832",
  "Transport":     "#3BB8A0",
  "Entertainment": "#E8526A",
  "Health":        "#5BA85E",
  "Subscriptions": "#7B6FE8",
  "Coffee":        "#C4A832",
  "Groceries":     "#C4A832",
  "Other":         "#4A5060",
};

const ROTATIONS = [-2, 1, -1.5, 2, -0.5, 1.5, -1, 0.5, -2.5, 0];

export function ReceiptCollageCard({ expense, index, onDelete, isDeleting }: Props) {
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [hovered, setHovered] = useState(false);

  const rotation = ROTATIONS[index % ROTATIONS.length];
  const amountDollars = expense.amount / 100;
  const formattedAmount = amountDollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(expense.date));
  const emoji = categoryEmoji[expense.category] || "🧾";
  const pillColor = categoryPillColors[expense.category] || "#4A5060";
  const severity = amountDollars < 10 ? 1 : amountDollars < 50 ? 2 : amountDollars < 150 ? 3 : amountDollars < 500 ? 4 : 5;

  return (
    <div
      data-testid={`card-receipt-${expense.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#1A1A1A",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18,
        padding: "18px 16px 14px",
        position: "relative",
        breakInside: "avoid",
        marginBottom: 16,
        transform: hovered && deleteStep === 0
          ? "rotate(0deg) scale(1.025)"
          : `rotate(${rotation}deg)`,
        transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s",
        boxShadow: hovered
          ? "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,230,118,0.12)"
          : "0 4px 16px rgba(0,0,0,0.3)",
        cursor: "default",
      }}
    >
      {/* ✕ delete button — always visible */}
      {deleteStep === 0 && onDelete && (
        <button
          onClick={() => setDeleteStep(1)}
          data-testid={`button-delete-receipt-${expense.id}`}
          style={{
            position: "absolute", top: 10, right: 10,
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,82,82,0.25)")}
          onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          title="Delete receipt"
        >
          <X style={{ width: 11, height: 11, color: "#8A9099" }} />
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

      {/* Severity */}
      <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} style={{ fontSize: 11, opacity: n <= severity ? 1 : 0.15 }}>🔥</span>
        ))}
      </div>

      {/* ── Step 1: First confirm overlay ── */}
      {deleteStep === 1 && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 18,
          background: "rgba(18,18,18,0.96)", backdropFilter: "blur(4px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 20, gap: 12,
          animation: "slideUp 0.18s ease both",
        }}>
          <X style={{ width: 20, height: 20, color: "#FF5252" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800,
              fontSize: 14, color: "#FFFFFF", margin: "0 0 4px",
            }}>
              Delete this receipt?
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#4A5060", margin: 0 }}>
              {expense.description} · {formattedAmount}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              onClick={() => setDeleteStep(0)}
              data-testid={`button-collage-cancel-1-${expense.id}`}
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
              onClick={() => setDeleteStep(2)}
              data-testid={`button-collage-confirm-1-${expense.id}`}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                background: "rgba(255,82,82,0.15)", color: "#FF5252",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Final confirm overlay ── */}
      {deleteStep === 2 && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 18,
          background: "rgba(18,18,18,0.97)", backdropFilter: "blur(4px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 20, gap: 12,
          animation: "slideUp 0.18s ease both",
        }}>
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
              Really delete?
            </p>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              color: "#8A9099", margin: 0, lineHeight: 1.5,
            }}>
              Permanently removes this receipt. No undo.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              onClick={() => setDeleteStep(0)}
              data-testid={`button-collage-cancel-2-${expense.id}`}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                color: "#8A9099", fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600, fontSize: 12, cursor: "pointer",
              }}
            >
              No, keep it
            </button>
            <button
              onClick={() => onDelete?.()}
              disabled={isDeleting}
              data-testid={`button-collage-confirm-2-${expense.id}`}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                background: isDeleting ? "rgba(255,82,82,0.1)" : "#FF5252",
                color: isDeleting ? "#FF5252" : "#FFFFFF",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12,
                cursor: isDeleting ? "not-allowed" : "pointer",
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              {isDeleting ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
