import { pgTable, serial, text, integer, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { index, jsonb } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Subscription tier: free | premium
  tier: varchar("tier").default("free").notNull(),
  // Stripe billing fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  // Free tier upload tracking
  monthlyUploadCount: integer("monthly_upload_count").default(0).notNull(),
  monthlyUploadResetDate: timestamp("monthly_upload_reset_date"),
  // One-time annual report purchase
  hasAnnualReport: boolean("has_annual_report").default(false).notNull(),
  // Preferred display currency (e.g. "USD", "CAD", "EUR")
  currency: varchar("currency").default("USD").notNull(),
  // Onboarding — defaults true to grandfather existing users; new users inserted as false
  onboardingComplete: boolean("onboarding_complete").default(true).notNull(),
  // Email verification — defaults true to grandfather existing users; new users inserted as false
  emailVerified: boolean("email_verified").default(true).notNull(),
  emailVerificationCode: varchar("email_verification_code"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  // Email/password auth
  passwordHash: varchar("password_hash"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  category: text("category").notNull(),
  roast: text("roast").notNull(),
  imageUrl: text("image_url"),
  source: text("source").default("receipt"),
  currency: varchar("currency").default("USD").notNull(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const categoryRules = pgTable("category_rules", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  merchantPattern: text("merchant_pattern").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CategoryRule = typeof categoryRules.$inferSelect;

export const monthlyVerdicts = pgTable("monthly_verdicts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  month: varchar("month").notNull(),
  source: varchar("source").default("all").notNull(),
  roast: text("roast").notNull(),
  regenCount: integer("regen_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type MonthlyVerdict = typeof monthlyVerdicts.$inferSelect;

export const statementRoasts = pgTable("statement_roasts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  month: varchar("month").notNull(),
  roast: text("roast").notNull(),
  tone: varchar("tone").default("sergio").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type StatementRoast = typeof statementRoasts.$inferSelect;

export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contactSubmissions).omit({ id: true, createdAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
