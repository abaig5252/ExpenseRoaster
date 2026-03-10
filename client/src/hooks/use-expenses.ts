import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ExpenseResponse } from "@shared/routes";

function parseDates(data: any) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(item => ({ ...item, date: item.date ? new Date(item.date) : item.date }));
  if (data.date) return { ...data, date: new Date(data.date) };
  return data;
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (res.status === 401) { window.location.href = "/login"; throw new Error("Unauthorized"); }
  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.message || "Request failed");
    }
    throw new Error(`Request failed (${res.status})`);
  }
  if (res.status === 204) return res;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json") && !ct.includes("text/plain")) {
    throw new Error("Unexpected server response — please try again");
  }
  return res;
}

export function useExpenses() {
  return useQuery<ExpenseResponse[]>({
    queryKey: [api.expenses.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.expenses.list.path);
      return parseDates(await res.json());
    },
  });
}

export function useExpenseSummary() {
  return useQuery<{ monthlyTotal: number; recentRoasts: string[] }>({
    queryKey: [api.expenses.summary.path],
    queryFn: async () => {
      const res = await apiFetch(api.expenses.summary.path);
      return res.json();
    },
  });
}

export function useMonthlyRoast(month: string | null, source?: string) {
  return useQuery<{ roast: string | null; total: number; count: number }>({
    queryKey: ['/api/expenses/monthly-roast', month, source],
    queryFn: async () => {
      const params = new URLSearchParams({ month: month! });
      if (source) params.set('source', source);
      const res = await apiFetch(`/api/expenses/monthly-roast?${params}`);
      return res.json();
    },
    enabled: !!month,
  });
}

export function useMonthlySeries() {
  return useQuery<{ month: string; total: number; count: number }[]>({
    queryKey: [api.expenses.monthlySeries.path],
    queryFn: async () => {
      const res = await apiFetch(api.expenses.monthlySeries.path);
      return res.json();
    },
  });
}

export type AdviceBreakdown = {
  category: string;
  roast: string;
  insight: string;
  alternatives: string[];
  potentialSaving: number;
};

export function useFinancialAdvice(filters?: { month?: string | null; year?: string | null; categories?: string[]; source?: string }) {
  const month = filters?.month ?? null;
  const year = filters?.year ?? null;
  const categories = filters?.categories ?? [];
  const source = filters?.source ?? "all";
  const catKey = [...categories].sort().join(",");

  const url = (() => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    else if (year) params.set("year", year);
    if (categories.length > 0) params.set("categories", catKey);
    if (source && source !== "all") params.set("source", source);
    const qs = params.toString();
    return qs ? `${api.expenses.financialAdvice.path}?${qs}` : api.expenses.financialAdvice.path;
  })();

  return useQuery<{ advice: string; topCategory: string; savingsPotential: number; breakdown: AdviceBreakdown[]; timeContext?: string }>({
    queryKey: [api.expenses.financialAdvice.path, month, year, catKey, source],
    retry: false,
    queryFn: async () => {
      const res = await apiFetch(url);
      return res.json();
    },
  });
}

export type PreviewData = {
  amount: number;
  description: string;
  date: string;
  category: string;
  roast: string;
  currency: string;
};

export function usePreviewReceipt() {
  return useMutation({
    mutationFn: async (data: { image: string; tone?: string }) => {
      const res = await apiFetch("/api/expenses/preview-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json() as Promise<PreviewData>;
    },
  });
}

export function useConfirmReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { amount: number; description: string; date: string; category: string; roast: string }) => {
      const res = await apiFetch("/api/expenses/confirm-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return parseDates(await res.json()) as ExpenseResponse & { ephemeral?: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.monthlySeries.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.financialAdvice.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    },
  });
}

export function useUploadExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { image: string; tone?: string }) => {
      const res = await apiFetch(api.expenses.upload.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return parseDates(await res.json()) as ExpenseResponse & { ephemeral?: boolean; uploadsUsed?: number; uploadsLimit?: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.monthlySeries.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.financialAdvice.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    },
  });
}

export function useAddManualExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      amount: number;
      description: string;
      category: string;
      date: string;
      source: "manual" | "bank_statement";
      tone?: string;
      currency?: string;
    }) => {
      const res = await apiFetch(api.expenses.addManual.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return parseDates(await res.json()) as ExpenseResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.monthlySeries.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.financialAdvice.path] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, description, amount, category, date, currency }: { id: number; description?: string; amount?: number; category?: string; date?: string; currency?: string }) => {
      return apiFetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amount, category, date, currency }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.monthlySeries.path] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.monthlySeries.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.financialAdvice.path] });
    },
  });
}

export function useBulkDeleteExpenses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      await apiFetch("/api/expenses/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.monthlySeries.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.financialAdvice.path] });
    },
  });
}
