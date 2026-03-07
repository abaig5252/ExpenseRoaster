/**
 * Parse a receipt/expense date safely, avoiding UTC-midnight timezone shift.
 *
 * Dates come from the server as ISO strings like "2024-11-17T00:00:00.000Z"
 * (UTC midnight). Calling new Date() on these and then formatting in local
 * time shifts the date backward in negative-UTC timezones (e.g. EST shows Nov 16).
 *
 * This function extracts the YYYY-MM-DD from the UTC representation and
 * constructs a local-noon Date so display formatters always show the correct date.
 */
export function parseReceiptDate(date: string | Date): Date {
  const iso = typeof date === "string" ? date : date.toISOString();
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Extract the "YYYY-MM" string from a receipt date without timezone shift.
 * Use this for grouping/filtering rather than date.toISOString().slice(0,7).
 */
export function receiptDateYM(date: string | Date): string {
  const iso = typeof date === "string" ? date : date.toISOString();
  return iso.slice(0, 7);
}
