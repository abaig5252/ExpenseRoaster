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
  if (res.status === 401) { window.location.href = "/api/login"; throw new Error("Unauthorized"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Request failed"); }
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

export function useMonthlySeries() {
  return useQuery<{ month: string; total: number; count: number }[]>({
    queryKey: [api.expenses.monthlySeries.path],
    queryFn: async () => {
      const res = await apiFetch(api.expenses.monthlySeries.path);
      return res.json();
    },
  });
}

export function useFinancialAdvice() {
  return useQuery<{ advice: string; topCategory: string; savingsPotential: number }>({
    queryKey: [api.expenses.financialAdvice.path],
    retry: false,
    queryFn: async () => {
      const res = await apiFetch(api.expenses.financialAdvice.path);
      return res.json();
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
