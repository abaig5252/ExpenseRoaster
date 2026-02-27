import { z } from 'zod';
import { insertExpenseSchema, expenses } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  internal: z.object({ message: z.string() }),
};

const expenseShape = z.custom<typeof expenses.$inferSelect>();

export const api = {
  expenses: {
    list: {
      method: 'GET' as const,
      path: '/api/expenses' as const,
      responses: {
        200: z.array(expenseShape),
      },
    },
    upload: {
      method: 'POST' as const,
      path: '/api/expenses/upload' as const,
      input: z.object({ image: z.string() }),
      responses: {
        201: expenseShape,
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    addManual: {
      method: 'POST' as const,
      path: '/api/expenses/manual' as const,
      input: z.object({
        amount: z.number().positive(),
        description: z.string().min(1),
        category: z.string().min(1),
        date: z.string(),
        source: z.enum(['manual', 'bank_statement']).default('manual'),
      }),
      responses: {
        201: expenseShape,
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/expenses/:id' as const,
      responses: {
        204: z.void(),
      },
    },
    summary: {
      method: 'GET' as const,
      path: '/api/expenses/summary' as const,
      responses: {
        200: z.object({
          monthlyTotal: z.number(),
          recentRoasts: z.array(z.string()),
        }),
      },
    },
    monthlySeries: {
      method: 'GET' as const,
      path: '/api/expenses/monthly-series' as const,
      responses: {
        200: z.array(z.object({
          month: z.string(),
          total: z.number(),
          count: z.number(),
        })),
      },
    },
    financialAdvice: {
      method: 'GET' as const,
      path: '/api/expenses/financial-advice' as const,
      responses: {
        200: z.object({
          advice: z.string(),
          topCategory: z.string(),
          savingsPotential: z.number(),
        }),
      },
    },
  },
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
