import { Trash2 } from "lucide-react";
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

const funCategoryNames: Record<string, string> = {
  "Food & Drink":  "FLAVOR CRIMES",
  "Shopping":      "RETAIL THERAPY",
  "Transport":     "ESCAPE ATTEMPTS",
  "Entertainment": "AVOIDANCE BUDGET",
  "Health":        "DAMAGE CONTROL",
  "Subscriptions": "DIGITAL HOARDING",
  "Coffee":        "DAILY SURRENDER",
  "Groceries":     "SUSTENANCE",
  "Other":         "MISC. SIN",
};

const sourceLabels: Record<string, string> = {
  "bank_statement": "Bank",
  "receipt":        "Receipt",
  "manual":         "Manual",
};

export function ExpenseCard({ expense, index, onDelete, isDeleting, isDisgrace = false }: ExpenseCardProps) {
  const amountDollars = expense.amount / 100;
  const formattedAmount = amountDollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(expense.date));

  const emoji = categoryEmoji[expense.category] || "🧾";
  const funCategory = funCategoryNames[expense.category] || expense.category.toUpperCase();
  const sourceLabel = sourceLabels[expense.source || ""] || "Receipt";

  const baseSeverity = amountDollars < 10 ? 1 : amountDollars < 50 ? 2 : amountDollars < 150 ? 3 : amountDollars < 500 ? 4 : 5;
  const severity = isDisgrace ? 5 : baseSeverity;

  const accentColor = isDisgrace ? "#FF5252" : "#00E676";

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
              color: isDisgrace ? "#1A0000" : "#002A14",
              background: accentColor,
              padding: "3px 7px", borderRadius: 6,
            }}>
              {funCategory}
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

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={isDeleting}
          data-testid={`button-delete-${expense.id}`}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all duration-200"
          title="Delete expense"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
