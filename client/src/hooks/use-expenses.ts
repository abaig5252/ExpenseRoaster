import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ExpenseResponse, type ExpenseInput } from "@shared/routes";

// Helper to handle date coercion from JSON strings
function parseDates(data: any) {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => ({
      ...item,
      date: item.date ? new Date(item.date) : item.date,
    }));
  }
  if (data.date) {
    return { ...data, date: new Date(data.date) };
  }
  return data;
}

function parseWithLogging<T>(schema: { safeParse: (data: unknown) => any }, data: unknown, label: string): T {
  const parsedData = parseDates(data);
  const result = schema.safeParse(parsedData);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useExpenses() {
  return useQuery({
    queryKey: [api.expenses.list.path],
    queryFn: async () => {
      const res = await fetch(api.expenses.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const json = await res.json();
      return parseWithLogging<ExpenseResponse[]>(api.expenses.list.responses[200], json, "expenses.list");
    },
  });
}

export function useExpenseSummary() {
  return useQuery({
    queryKey: [api.expenses.summary.path],
    queryFn: async () => {
      const res = await fetch(api.expenses.summary.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const json = await res.json();
      return parseWithLogging<{ monthlyTotal: number; recentRoasts: string[] }>(
        api.expenses.summary.responses[200], 
        json, 
        "expenses.summary"
      );
    },
  });
}

export function useUploadExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { image: string }) => {
      const validated = api.expenses.upload.input.parse(data);
      const res = await fetch(api.expenses.upload.path, {
        method: api.expenses.upload.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Validation failed");
        }
        throw new Error("Failed to upload receipt");
      }
      
      const json = await res.json();
      return parseWithLogging<ExpenseResponse>(api.expenses.upload.responses[201], json, "expenses.upload");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.summary.path] });
    },
  });
}
