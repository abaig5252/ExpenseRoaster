import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useMe() {
  return useQuery<User>({
    queryKey: ["/api/me"],
    retry: false,
    staleTime: 1000 * 60 * 2,
  });
}

export function useStripeProducts() {
  return useQuery<any[]>({
    queryKey: ["/api/stripe/products"],
    staleTime: 1000 * 60 * 5,
  });
}

export function useSubscription() {
  return useQuery<{ subscription: any }>({
    queryKey: ["/api/stripe/subscription"],
    staleTime: 1000 * 60 * 2,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: async ({ priceId, mode }: { priceId: string; mode?: string }) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { priceId, mode });
      const data = await res.json();
      return data as { url: string };
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal", {});
      const data = await res.json();
      return data as { url: string };
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}

export function useFulfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", "/api/stripe/fulfill", { sessionId });
      return res.json() as Promise<{ user: User }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    },
  });
}

export function useMonthlyRoast() {
  return useQuery<{ roast: string }>({
    queryKey: ["/api/expenses/monthly-roast"],
    retry: false,
  });
}

export function useAnnualReport() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/expenses/annual-report", {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate report");
      }
      return res.json();
    },
  });
}

export function useImportCSV() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ csvData, tone }: { csvData: string; tone: string }) => {
      const res = await apiRequest("POST", "/api/expenses/import-csv", { csvData, tone });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }
      return res.json() as Promise<{ imported: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/summary"] });
    },
  });
}
