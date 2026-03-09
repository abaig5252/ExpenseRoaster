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

export function formatAmount(cents: number, currencyCode: string) {
  const code = currencyCode || "USD";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: code });
}
