import { db } from "./db";
import { expenses, users, contactSubmissions, categoryRules, monthlyVerdicts, statementRoasts, annualReports, type Expense, type InsertExpense, type User, type UpsertUser, type InsertContact, type CategoryRule, type MonthlyVerdict, type StatementRoast } from "@shared/schema";
import { eq, desc, gte, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  getUserByEmail(email: string): Promise<User | undefined>;
  createLocalUser(data: { email: string; passwordHash: string; firstName: string }): Promise<User>;
  setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
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
  updateExpense(id: number, userId: string, data: { description?: string; amount?: number; category?: string; date?: Date; currency?: string; roast?: string }): Promise<Expense>;
  deleteExpense(id: number, userId: string): Promise<void>;
  bulkDeleteExpenses(userId: string, ids: number[]): Promise<number>;
  getMonthlySummary(userId: string): Promise<{ monthlyTotal: number; recentRoasts: string[] }>;
  getMonthlySeries(userId: string): Promise<{ month: string; total: number; count: number }[]>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; currency?: string; onboardingComplete?: boolean }): Promise<User>;
  setEmailVerificationCode(userId: string, code: string, expires: Date): Promise<void>;
  verifyEmailCode(userId: string, code: string): Promise<'valid' | 'expired' | 'invalid'>;
  getCategoryRules(userId: string): Promise<CategoryRule[]>;
  upsertCategoryRule(userId: string, merchantPattern: string, category: string): Promise<void>;
  getMonthlyVerdict(userId: string, month: string, source: string): Promise<MonthlyVerdict | null>;
  saveMonthlyVerdict(userId: string, month: string, source: string, roast: string): Promise<MonthlyVerdict>;
  regenerateMonthlyVerdict(id: number, roast: string): Promise<MonthlyVerdict>;
  updateVerdictRoast(id: number, roast: string): Promise<MonthlyVerdict>;
  getStatementRoast(userId: string, month: string): Promise<StatementRoast | null>;
  saveStatementRoast(userId: string, month: string, roast: string, tone: string): Promise<StatementRoast>;
  getStatementMonths(userId: string): Promise<string[]>;
  saveAnnualReport(userId: string, reportYear: number, ytdLabel: string, reportData: Record<string, unknown>): Promise<void>;
  getLatestAnnualReport(userId: string): Promise<Record<string, unknown> | null>;
}

export class DatabaseStorage implements IStorage {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    return user;
  }

  async createLocalUser(data: { email: string; passwordHash: string; firstName: string }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      emailVerified: false,
      onboardingComplete: false,
    }).returning();
    return user;
  }

  async setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
    await db.update(users).set({ passwordResetToken: token, passwordResetExpires: expires, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash, passwordResetToken: null, passwordResetExpires: null, updatedAt: new Date() }).where(eq(users.id, userId));
  }

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
    const shouldReset = !resetDate || now.getMonth() !== new Date(resetDate).getMonth() || now.getFullYear() !== new Date(resetDate).getFullYear();

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

  async updateExpense(id: number, userId: string, data: { description?: string; amount?: number; category?: string; date?: Date; currency?: string; roast?: string }): Promise<Expense> {
    const [updated] = await db
      .update(expenses)
      .set(data)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();
    return updated;
  }

  async deleteExpense(id: number, userId: string): Promise<void> {
    await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  }

  async bulkDeleteExpenses(userId: string, ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db
      .delete(expenses)
      .where(and(eq(expenses.userId, userId), inArray(expenses.id, ids)));
    return (result as any).rowCount ?? ids.length;
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

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; currency?: string; onboardingComplete?: boolean }): Promise<User> {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return user;
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

  async getCategoryRules(userId: string): Promise<CategoryRule[]> {
    return db.select().from(categoryRules)
      .where(eq(categoryRules.userId, userId))
      .orderBy(desc(categoryRules.createdAt))
      .limit(50);
  }

  async upsertCategoryRule(userId: string, merchantPattern: string, category: string): Promise<void> {
    const existing = await db.select().from(categoryRules)
      .where(and(eq(categoryRules.userId, userId), eq(categoryRules.merchantPattern, merchantPattern)));
    if (existing.length > 0) {
      await db.update(categoryRules)
        .set({ category })
        .where(and(eq(categoryRules.userId, userId), eq(categoryRules.merchantPattern, merchantPattern)));
    } else {
      await db.insert(categoryRules).values({ userId, merchantPattern, category });
    }
  }

  async getMonthlyVerdict(userId: string, month: string, source: string): Promise<MonthlyVerdict | null> {
    const [row] = await db.select().from(monthlyVerdicts)
      .where(and(
        eq(monthlyVerdicts.userId, userId),
        eq(monthlyVerdicts.month, month),
        eq(monthlyVerdicts.source, source),
      ));
    return row ?? null;
  }

  async saveMonthlyVerdict(userId: string, month: string, source: string, roast: string): Promise<MonthlyVerdict> {
    const [row] = await db.insert(monthlyVerdicts)
      .values({ userId, month, source, roast, regenCount: 0 })
      .returning();
    return row;
  }

  async regenerateMonthlyVerdict(id: number, roast: string): Promise<MonthlyVerdict> {
    const [row] = await db.update(monthlyVerdicts)
      .set({ roast, regenCount: sql`${monthlyVerdicts.regenCount} + 1` })
      .where(eq(monthlyVerdicts.id, id))
      .returning();
    return row;
  }

  async updateVerdictRoast(id: number, roast: string): Promise<MonthlyVerdict> {
    const [row] = await db.update(monthlyVerdicts)
      .set({ roast })
      .where(eq(monthlyVerdicts.id, id))
      .returning();
    return row;
  }

  async getStatementRoast(userId: string, month: string): Promise<StatementRoast | null> {
    const [row] = await db.select().from(statementRoasts)
      .where(and(eq(statementRoasts.userId, userId), eq(statementRoasts.month, month)))
      .orderBy(desc(statementRoasts.createdAt))
      .limit(1);
    return row ?? null;
  }

  async saveStatementRoast(userId: string, month: string, roast: string, tone: string): Promise<StatementRoast> {
    const existing = await this.getStatementRoast(userId, month);
    if (existing) {
      const [row] = await db.update(statementRoasts)
        .set({ roast, tone })
        .where(eq(statementRoasts.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(statementRoasts).values({ userId, month, roast, tone }).returning();
    return row;
  }

  async getStatementMonths(userId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ month: sql<string>`to_char(${expenses.date}, 'YYYY-MM')` })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.source, "bank_statement")))
      .orderBy(desc(sql`to_char(${expenses.date}, 'YYYY-MM')`));
    return rows.map(r => r.month);
  }

  async saveAnnualReport(userId: string, reportYear: number, ytdLabel: string, reportData: Record<string, unknown>): Promise<void> {
    await db.insert(annualReports).values({ userId, reportYear, ytdLabel, reportData });
  }

  async getLatestAnnualReport(userId: string): Promise<Record<string, unknown> | null> {
    const [row] = await db
      .select()
      .from(annualReports)
      .where(eq(annualReports.userId, userId))
      .orderBy(desc(annualReports.generatedAt))
      .limit(1);
    if (!row) return null;
    return {
      ...(row.reportData as Record<string, unknown>),
      reportYear: row.reportYear,
      ytdLabel: row.ytdLabel,
      generatedAt: row.generatedAt,
    };
  }
}

export const storage = new DatabaseStorage();
