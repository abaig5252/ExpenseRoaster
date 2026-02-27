import { z } from 'zod';
import { insertExpenseSchema, expenses } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  expenses: {
    list: {
      method: 'GET' as const,
      path: '/api/expenses' as const,
      responses: {
        200: z.array(z.custom<typeof expenses.$inferSelect>()),
      },
    },
    upload: {
      method: 'POST' as const,
      path: '/api/expenses/upload' as const,
      input: z.object({
        image: z.string(), // base64 encoded image
      }),
      responses: {
        201: z.custom<typeof expenses.$inferSelect>(),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    summary: {
      method: 'GET' as const,
      path: '/api/expenses/summary' as const,
      responses: {
        200: z.object({
          monthlyTotal: z.number(), // in cents
          recentRoasts: z.array(z.string()),
        }),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ExpenseInput = z.infer<typeof insertExpenseSchema>;
export type ExpenseResponse = typeof expenses.$inferSelect;
