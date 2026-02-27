import { db } from "./db";
import { expenses, users, type Expense, type InsertExpense, type User, type UpsertUser } from "@shared/schema";
import { eq, desc, gte, and, sql } from "drizzle-orm";

export interface IStorage {
  // Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  // Expenses
  getExpenses(userId: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: number, userId: string): Promise<void>;
  getMonthlySummary(userId: string): Promise<{ monthlyTotal: number; recentRoasts: string[] }>;
  getMonthlySeries(userId: string): Promise<{ month: string; total: number; count: number }[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async getExpenses(userId: string): Promise<Expense[]> {
    return await db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.date));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async deleteExpense(id: number, userId: string): Promise<void> {
    await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  }

  async getMonthlySummary(userId: string): Promise<{ monthlyTotal: number; recentRoasts: string[] }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyExpenses = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.userId, userId), gte(expenses.date, startOfMonth)))
      .orderBy(desc(expenses.date));

    const monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const recentRoasts = monthlyExpenses.slice(0, 5).map((e) => e.roast);
    return { monthlyTotal, recentRoasts };
  }

  async getMonthlySeries(userId: string): Promise<{ month: string; total: number; count: number }[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        month: sql<string>`to_char(${expenses.date}, 'YYYY-MM')`,
        total: sql<number>`sum(${expenses.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), gte(expenses.date, twelveMonthsAgo)))
      .groupBy(sql`to_char(${expenses.date}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${expenses.date}, 'YYYY-MM')`);

    return rows.map((r) => ({
      month: r.month,
      total: Number(r.total),
      count: Number(r.count),
    }));
  }
}

export const storage = new DatabaseStorage();
