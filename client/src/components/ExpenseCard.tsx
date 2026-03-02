import { useState } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import type { ExpenseResponse } from "@shared/routes";

interface ExpenseCardProps {
  expense: ExpenseResponse;
  index: number;
  onDelete?: () => void;
  isDeleting?: boolean;
  isDisgrace?: boolean;
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
  "Subscriptions": "#E8526A",
  "Coffee":        "#7B6FE8",
  "Groceries":     "#C4A832",
  "Other":         "#4A5060",
};

const sourceLabels: Record<string, string> = {
  "bank_statement": "Bank",
  "receipt":        "Receipt",
  "manual":         "Manual",
};

export function ExpenseCard({ expense, index, onDelete, isDeleting, isDisgrace = false }: ExpenseCardProps) {
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);

  const amountDollars = expense.amount / 100;
  const formattedAmount = amountDollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(expense.date));

  const emoji = categoryEmoji[expense.category] || "🧾";
  const pillColor = isDisgrace ? "#FF5252" : (categoryPillColors[expense.category] || "#4A5060");
  const sourceLabel = sourceLabels[expense.source || ""] || "Receipt";

  const baseSeverity = amountDollars < 10 ? 1 : amountDollars < 50 ? 2 : amountDollars < 150 ? 3 : amountDollars < 500 ? 4 : 5;
  const severity = isDisgrace ? 5 : baseSeverity;

  const accentColor = isDisgrace ? "#FF5252" : "#00E676";

  function handleTrashClick() {
    setDeleteStep(1);
  }

  function handleFirstConfirm() {
    setDeleteStep(2);
  }

  function handleCancel() {
    setDeleteStep(0);
  }

  function handleFinalDelete() {
    onDelete?.();
  }

  return (
    <div
      data-testid={`card-expense-${expense.id}`}
      className="group relative overflow-hidden"
      style={{
        background: "#1A1A1A",
        borderRadius: 20,
        padding: 16,
        border: isDisgrace ? "1px solid rgba(255,82,82,0.25)" : "1px solid rgba(255,255,255,0.05)",
        borderLeft: `3px solid ${accentColor}`,
        marginBottom: 10,
        animation: "slideUp 0.4s ease both",
        animationDelay: `${index * 70}ms`,
      }}
    >
      {/* Monthly Disgrace badge */}
      {isDisgrace && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "rgba(255,82,82,0.12)", border: "1px solid rgba(255,82,82,0.25)",
          color: "#FF5252", fontSize: 10, fontWeight: 800,
          fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.06em",
          padding: "3px 8px", borderRadius: 6, marginBottom: 10,
        }}>
          🏆 MONTHLY DISGRACE
        </div>
      )}

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        {/* Icon square */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: "#242424",
          border: `1px solid ${isDisgrace ? "rgba(255,82,82,0.22)" : "rgba(0,230,118,0.22)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, flexShrink: 0,
        }}>
          {emoji}
        </div>

        {/* Center: name + tags */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700,
            fontSize: 15, color: "#FFFFFF", marginBottom: 6, fontStyle: "normal",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {expense.description}
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "#FFFFFF",
              background: pillColor,
              padding: "3px 7px", borderRadius: 6,
            }}>
              {expense.category}
            </span>
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 10,
              color: "#4A5060", fontWeight: 500,
            }}>
              📄 {sourceLabel}
            </span>
          </div>
        </div>

        {/* Right: amount + date */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800,
            fontSize: 26, color: isDisgrace ? "#FF5252" : "#FFFFFF",
            letterSpacing: "-1px", lineHeight: 1, fontStyle: "normal",
          }}>
            {formattedAmount}
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 11,
            color: "#4A5060", marginTop: 4,
          }}>
            {formattedDate}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 12px" }} />

      {/* Roast box */}
      {expense.roast && (
        <div style={{
          background: isDisgrace ? "rgba(255,82,82,0.07)" : "rgba(0,230,118,0.06)",
          border: `1px solid ${isDisgrace ? "rgba(255,82,82,0.2)" : "rgba(0,230,118,0.2)"}`,
          borderRadius: 12, padding: 14,
          display: "flex", gap: 10, alignItems: "flex-start",
          animation: "roastReveal 0.4s ease both",
          animationDelay: "0.6s",
        }}>
          <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🔥</span>
          <p style={{
            fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 500,
            fontStyle: "italic", fontSize: 13,
            color: isDisgrace ? "#FF7070" : "#69FF9C",
            lineHeight: 1.75, letterSpacing: "0.01em", margin: 0,
          }}>
            "{expense.roast}"
          </p>
        </div>
      )}

      {/* Severity flames row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 3,
        paddingTop: 10, marginTop: 10,
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 10,
          color: "#4A5060", marginRight: 4, fontWeight: 500,
        }}>
          Severity
        </span>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} style={{ fontSize: 12, opacity: n <= severity ? 1 : 0.2 }}>🔥</span>
        ))}
      </div>

      {/* Trash button — hidden until hover, not shown when confirming */}
      {onDelete && deleteStep === 0 && (
        <button
          onClick={handleTrashClick}
          data-testid={`button-delete-${expense.id}`}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all duration-200"
          title="Delete expense"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* ── Step 1: First confirmation overlay ── */}
      {deleteStep === 1 && (
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: 20,
            background: "rgba(18,18,18,0.96)",
            backdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 20, gap: 14,
            animation: "slideUp 0.18s ease both",
          }}
        >
          <Trash2 style={{ width: 22, height: 22, color: "#FF5252" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800,
              fontSize: 15, color: "#FFFFFF", margin: "0 0 4px",
            }}>
              Delete this expense?
            </p>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12,
              color: "#4A5060", margin: 0,
            }}>
              {expense.description} · {formattedAmount}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              onClick={handleCancel}
              data-testid={`button-delete-cancel-1-${expense.id}`}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "#8A9099",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13,
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseOut={e => (e.currentTarget.style.background = "transparent")}
            >
              Cancel
            </button>
            <button
              onClick={handleFirstConfirm}
              data-testid={`button-delete-confirm-1-${expense.id}`}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
                background: "rgba(255,82,82,0.15)", color: "#FF5252",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(255,82,82,0.25)")}
              onMouseOut={e => (e.currentTarget.style.background = "rgba(255,82,82,0.15)")}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Second (final) confirmation overlay ── */}
      {deleteStep === 2 && (
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: 20,
            background: "rgba(18,18,18,0.97)",
            backdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 20, gap: 14,
            animation: "slideUp 0.18s ease both",
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(255,82,82,0.12)", border: "1px solid rgba(255,82,82,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <AlertTriangle style={{ width: 20, height: 20, color: "#FF5252" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800,
              fontSize: 15, color: "#FFFFFF", margin: "0 0 6px",
            }}>
              Really delete?
            </p>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12,
              color: "#8A9099", margin: 0, lineHeight: 1.5,
            }}>
              This permanently removes the expense and its roast. There's no undo.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              onClick={handleCancel}
              data-testid={`button-delete-cancel-2-${expense.id}`}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "#8A9099",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13,
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseOut={e => (e.currentTarget.style.background = "transparent")}
            >
              No, keep it
            </button>
            <button
              onClick={handleFinalDelete}
              disabled={isDeleting}
              data-testid={`button-delete-confirm-2-${expense.id}`}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
                background: isDeleting ? "rgba(255,82,82,0.1)" : "#FF5252",
                color: isDeleting ? "#FF5252" : "#FFFFFF",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
                cursor: isDeleting ? "not-allowed" : "pointer",
                transition: "background 0.15s, opacity 0.15s",
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
