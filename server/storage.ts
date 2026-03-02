import { db } from "./db";
import { expenses, users, contactSubmissions, type Expense, type InsertExpense, type User, type UpsertUser, type InsertContact } from "@shared/schema";
import { eq, desc, gte, and, sql } from "drizzle-orm";

export interface IStorage {
  createContactSubmission(data: InsertContact): Promise<void>;
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserTier(userId: string, tier: string, stripeCustomerId?: string, stripeSubscriptionId?: string): Promise<User>;
  updateUserAnnualReport(userId: string, hasAnnualReport: boolean): Promise<User>;
  updateUserStripeCustomer(userId: string, stripeCustomerId: string): Promise<User>;
  checkAndResetMonthlyUpload(userId: string): Promise<User>;
  incrementMonthlyUpload(userId: string): Promise<User>;
  getExpenses(userId: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: number, userId: string): Promise<void>;
  getMonthlySummary(userId: string): Promise<{ monthlyTotal: number; recentRoasts: string[] }>;
  getMonthlySeries(userId: string): Promise<{ month: string; total: number; count: number }[]>;
  setEmailVerificationCode(userId: string, code: string, expires: Date): Promise<void>;
  verifyEmailCode(userId: string, code: string): Promise<'valid' | 'expired' | 'invalid'>;
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

  async updateUserTier(userId: string, tier: string, stripeCustomerId?: string, stripeSubscriptionId?: string): Promise<User> {
    const update: any = { tier, updatedAt: new Date() };
    if (stripeCustomerId) update.stripeCustomerId = stripeCustomerId;
    if (stripeSubscriptionId) update.stripeSubscriptionId = stripeSubscriptionId;
    const [user] = await db.update(users).set(update).where(eq(users.id, userId)).returning();
    return user;
  }

  async updateUserAnnualReport(userId: string, hasAnnualReport: boolean): Promise<User> {
    const [user] = await db.update(users).set({ hasAnnualReport, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return user;
  }

  async updateUserStripeCustomer(userId: string, stripeCustomerId: string): Promise<User> {
    const [user] = await db.update(users).set({ stripeCustomerId, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return user;
  }

  async checkAndResetMonthlyUpload(userId: string): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error("User not found");

    const now = new Date();
    const resetDate = user.monthlyUploadResetDate;
    const shouldReset = !resetDate || now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear();

    if (shouldReset) {
      const [updated] = await db
        .update(users)
        .set({ monthlyUploadCount: 0, monthlyUploadResetDate: now, updatedAt: now })
        .where(eq(users.id, userId))
        .returning();
      return updated;
    }
    return user;
  }

  async incrementMonthlyUpload(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ monthlyUploadCount: sql`${users.monthlyUploadCount} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getExpenses(userId: string): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.date));
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

    return rows.map((r) => ({ month: r.month, total: Number(r.total), count: Number(r.count) }));
  }

  async createContactSubmission(data: InsertContact): Promise<void> {
    await db.insert(contactSubmissions).values(data);
  }

  async setEmailVerificationCode(userId: string, code: string, expires: Date): Promise<void> {
    await db.update(users).set({
      emailVerificationCode: code,
      emailVerificationExpires: expires,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
  }

  async verifyEmailCode(userId: string, code: string): Promise<'valid' | 'expired' | 'invalid'> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.emailVerificationCode || user.emailVerificationCode !== code) return 'invalid';
    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) return 'expired';
    await db.update(users).set({
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpires: null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
    return 'valid';
  }
}

export const storage = new DatabaseStorage();
