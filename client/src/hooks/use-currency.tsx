import { createContext, useContext, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "MXN", label: "MXN — Mexican Peso" },
  { code: "BRL", label: "BRL — Brazilian Real" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
];

interface CurrencyContextValue {
  currency: string;
  setCurrency: (code: string) => void;
  syncFromServer: (code: string) => void;
  formatAmount: (cents: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
  syncFromServer: () => {},
  formatAmount: (cents) =>
    (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" }),
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState(
    () => localStorage.getItem("er_currency") || "USD"
  );

  function setCurrency(code: string) {
    localStorage.setItem("er_currency", code);
    setCurrencyState(code);
    apiRequest("PATCH", "/api/me/profile", { currency: code }).catch(() => {});
  }

  function syncFromServer(code: string) {
    if (!code) return;
    localStorage.setItem("er_currency", code);
    setCurrencyState(code);
  }

  function formatAmount(cents: number) {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency });
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, syncFromServer, formatAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
