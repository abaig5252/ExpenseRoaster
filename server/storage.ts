import { db } from "./db";
import { expenses, type Expense, type InsertExpense } from "@shared/schema";
import { eq, desc, gte } from "drizzle-orm";

export interface IStorage {
  getExpenses(): Promise<Expense[]>;
  getExpense(id: number): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  getMonthlySummary(): Promise<{ monthlyTotal: number, recentRoasts: string[] }>;
}

export class DatabaseStorage implements IStorage {
  async getExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async getMonthlySummary(): Promise<{ monthlyTotal: number, recentRoasts: string[] }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyExpenses = await db.select().from(expenses).where(gte(expenses.date, startOfMonth)).orderBy(desc(expenses.date));
    
    const monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const recentRoasts = monthlyExpenses.slice(0, 5).map(e => e.roast);

    return { monthlyTotal, recentRoasts };
  }
}

export const storage = new DatabaseStorage();
