import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripe/stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const FREE_UPLOAD_LIMIT = 2;

const ROAST_PROMPTS: Record<string, string> = {
  savage: `You are a brutally savage, hilariously judgmental financial roaster. Be genuinely funny and merciless. Reference the specific purchase and amount. Channel a mix of disappointed parent + savage comedian. Make it hurt.`,
  playful: `You are a playfully cheeky financial roaster. Tease the user about their spending but keep it light and fun — like a best friend who can't believe you bought this. Funny and friendly, never mean.`,
  supportive: `You are a warm but honest financial advisor who gently calls out bad spending. Acknowledge the purchase with empathy, then softly point out the financial reality. Encouraging but real.`,
};

function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

async function generateRoast(description: string, amountCents: number, category: string, tone = "savage"): Promise<string> {
  const prompt = ROAST_PROMPTS[tone] || ROAST_PROMPTS.savage;
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Expense: ${description}, $${(amountCents / 100).toFixed(2)}, category: ${category}. Roast me in ONE sharp, specific sentence.` },
    ],
    max_completion_tokens: 120,
  });
  return response.choices[0]?.message?.content || "Wow. Just...wow.";
}

function getPriceForPlan(plan: string, prices: any[]): string | null {
  return prices.find((p: any) => p.metadata?.plan === plan)?.id || null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);

  // ─── Stripe: Publishable key ───────────────────────────────────────
  app.get("/api/stripe/config", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch {
      res.status(500).json({ message: "Stripe not configured" });
    }
  });

  // ─── Stripe: Products & prices ───────────────────────────────────
  app.get("/api/stripe/products", async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT p.id as product_id, p.name, p.description, p.metadata,
               pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring, pr.metadata as price_metadata
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY pr.unit_amount ASC
      `);
      res.json(rows.rows);
    } catch (err) {
      console.error("Products fetch error:", err);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // ─── Stripe: Current subscription ─────────────────────────────────
  app.get("/api/stripe/subscription", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user?.stripeSubscriptionId) return res.json({ subscription: null });
    try {
      const [sub] = (await db.execute(sql`SELECT * FROM stripe.subscriptions WHERE id = ${user.stripeSubscriptionId}`)).rows;
      res.json({ subscription: sub || null });
    } catch {
      res.json({ subscription: null });
    }
  });

  // ─── Stripe: Create checkout session ────────────────────────────
  app.post("/api/stripe/checkout", isAuthenticated, async (req: any, res) => {
    const { priceId, mode } = req.body;
    if (!priceId) return res.status(400).json({ message: "priceId required" });
    try {
      const userId = getUserId(req);
      let user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripe = await getUncachableStripeClient();
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId },
        });
        user = await storage.updateUserStripeCustomer(userId, customer.id);
        customerId = customer.id;
      }

      const host = `${req.protocol}://${req.get("host")}`;
      const checkoutMode = mode === "payment" ? "payment" : "subscription";
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: checkoutMode,
        success_url: `${host}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${host}/pricing`,
        metadata: { userId },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // ─── Stripe: Customer portal ─────────────────────────────────────
  app.post("/api/stripe/portal", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user?.stripeCustomerId) return res.status(400).json({ message: "No billing account" });
    try {
      const stripe = await getUncachableStripeClient();
      const host = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${host}/upload`,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error("Portal error:", err);
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });

  // ─── Stripe: Post-checkout fulfillment ──────────────────────────
  app.post("/api/stripe/fulfill", isAuthenticated, async (req: any, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "sessionId required" });
    try {
      const userId = getUserId(req);
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });

      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (session.mode === "subscription" && session.subscription) {
        const sub = session.subscription as any;
        await storage.updateUserTier(userId, "premium", session.customer as string, sub.id);
      } else if (session.mode === "payment" && session.payment_status === "paid") {
        await storage.updateUserAnnualReport(userId, true);
      }

      const user = await storage.getUser(userId);
      res.json({ user });
    } catch (err: any) {
      console.error("Fulfill error:", err);
      res.status(500).json({ message: "Failed to fulfill" });
    }
  });

  // ─── User info (with tier) ───────────────────────────────────────
  app.get("/api/me", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    res.json(user);
  });

  // ─── Expenses: List ─────────────────────────────────────────────
  app.get(api.expenses.list.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") return res.json([]);
    const list = await storage.getExpenses(userId);
    res.json(list);
  });

  // ─── Expenses: Summary ───────────────────────────────────────────
  app.get(api.expenses.summary.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") return res.json({ monthlyTotal: 0, recentRoasts: [] });
    const summary = await storage.getMonthlySummary(userId);
    res.json(summary);
  });

  // ─── Expenses: Monthly series ────────────────────────────────────
  app.get(api.expenses.monthlySeries.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") return res.json([]);
    const series = await storage.getMonthlySeries(userId);
    res.json(series);
  });

  // ─── Expenses: Financial advice (premium) ───────────────────────
  app.get(api.expenses.financialAdvice.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") {
      return res.status(403).json({ message: "Financial advice requires Premium" });
    }
    try {
      const allExpenses = await storage.getExpenses(userId);
      if (allExpenses.length === 0) {
        return res.json({ advice: "Upload some receipts first so I can roast your financial decisions properly.", topCategory: "Unknown", savingsPotential: 0 });
      }
      const categoryTotals: Record<string, number> = {};
      for (const exp of allExpenses) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      }
      const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "General";
      const totalSpend = allExpenses.reduce((s, e) => s + e.amount, 0);
      const savingsPotential = Math.round(totalSpend * 0.15);
      const summary = Object.entries(categoryTotals).map(([cat, amt]) => `${cat}: $${(amt / 100).toFixed(2)}`).join(", ");

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: `You are a brutally honest but secretly caring financial advisor. Give REAL, actionable advice in 2-3 punchy sentences. Be specific and mildly savage but ultimately helpful.` },
          { role: "user", content: `My spending by category: ${summary}. Top category is ${topCategory}. Give me sharp financial advice.` },
        ],
        max_completion_tokens: 200,
      });

      const advice = response.choices[0]?.message?.content || "Spend less. Save more.";
      res.json({ advice, topCategory, savingsPotential });
    } catch (err) {
      console.error("Financial advice error:", err);
      res.status(500).json({ message: "Failed to generate financial advice" });
    }
  });

  // ─── Expenses: Monthly roast summary (premium) ───────────────────
  app.get("/api/expenses/monthly-roast", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") return res.status(403).json({ message: "Premium required" });

    try {
      const allExpenses = await storage.getExpenses(userId);
      if (allExpenses.length === 0) return res.json({ roast: "Nothing to roast yet. Upload some receipts!" });

      const totalSpend = allExpenses.reduce((s, e) => s + e.amount, 0);
      const categoryTotals: Record<string, number> = {};
      for (const exp of allExpenses) categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, amt]) => `${cat}: $${(amt / 100).toFixed(2)}`).join(", ");

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: `You are a savage comedian doing a monthly roast of someone's spending habits. Be brutal, be funny, be specific. 3-4 sentences max.` },
          { role: "user", content: `Total spent: $${(totalSpend / 100).toFixed(2)}. Top categories: ${topCategories}. Roast my entire month of spending.` },
        ],
        max_completion_tokens: 200,
      });

      res.json({ roast: response.choices[0]?.message?.content || "Your spending is beyond roasting. I'm just impressed." });
    } catch (err) {
      console.error("Monthly roast error:", err);
      res.status(500).json({ message: "Failed to generate monthly roast" });
    }
  });

  // ─── Expenses: Upload receipt ────────────────────────────────────
  app.post(api.expenses.upload.path, isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      let user = await storage.checkAndResetMonthlyUpload(userId);

      const tone = req.body.tone || "savage";
      const isFree = user.tier === "free";

      if (isFree && user.monthlyUploadCount >= FREE_UPLOAD_LIMIT) {
        return res.status(403).json({
          message: `Free tier limit reached. You've used ${FREE_UPLOAD_LIMIT}/${FREE_UPLOAD_LIMIT} uploads this month.`,
          code: "UPLOAD_LIMIT_REACHED",
        });
      }

      const input = api.expenses.upload.input.parse(req.body);
      const systemPrompt = `${ROAST_PROMPTS[tone] || ROAST_PROMPTS.savage}

Extract expense data from this receipt image and deliver a roast.`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract the expense details and roast me. Respond ONLY with JSON: { "amount": <number in cents>, "description": "<short name>", "date": "<ISO date>", "category": "<Food & Drink|Shopping|Transport|Entertainment|Health|Subscriptions|Other>", "roast": "<your roast>" }` },
              { type: "image_url", image_url: { url: input.image } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const resultText = aiResponse.choices[0]?.message?.content;
      if (!resultText) throw new Error("No AI response");

      const extracted = JSON.parse(resultText);
      const parsedDate = new Date(extracted.date);
      const dateToUse = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

      // Increment upload count regardless of tier
      await storage.incrementMonthlyUpload(userId);

      // For free users: return roast data but don't store
      if (isFree) {
        return res.status(201).json({
          id: -1,
          userId,
          amount: Math.round(extracted.amount),
          description: extracted.description || "Unknown Purchase",
          date: dateToUse.toISOString(),
          category: extracted.category || "Other",
          roast: extracted.roast || "I'm speechless.",
          imageUrl: null,
          source: "receipt",
          ephemeral: true,
          uploadsUsed: user.monthlyUploadCount + 1,
          uploadsLimit: FREE_UPLOAD_LIMIT,
        });
      }

      const expense = await storage.createExpense({
        userId,
        amount: Math.round(extracted.amount),
        description: extracted.description || "Unknown Purchase",
        date: dateToUse,
        category: extracted.category || "Other",
        roast: extracted.roast || "I'm speechless.",
        imageUrl: null,
        source: "receipt",
      });

      res.status(201).json(expense);
    } catch (err) {
      console.error("Upload error:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to process receipt" });
    }
  });

  // ─── Expenses: Add manual ────────────────────────────────────────
  app.post(api.expenses.addManual.path, isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user || user.tier === "free") {
        return res.status(403).json({ message: "Manual expense entry requires Premium", code: "PREMIUM_REQUIRED" });
      }

      const input = api.expenses.addManual.input.parse(req.body);
      const tone = (req.body.tone as string) || "savage";
      const roast = await generateRoast(input.description, input.amount, input.category, tone);

      const expense = await storage.createExpense({
        userId,
        amount: Math.round(input.amount),
        description: input.description,
        date: new Date(input.date),
        category: input.category,
        roast,
        imageUrl: null,
        source: input.source,
      });

      res.status(201).json(expense);
    } catch (err) {
      console.error("Manual add error:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to add expense" });
    }
  });

  // ─── Expenses: CSV import (premium) ──────────────────────────────
  app.post("/api/expenses/import-csv", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") {
      return res.status(403).json({ message: "CSV import requires Premium", code: "PREMIUM_REQUIRED" });
    }

    const { csvData, tone } = req.body;
    if (!csvData) return res.status(400).json({ message: "csvData required" });

    try {
      const lines = csvData.split("\n").map((l: string) => l.trim()).filter(Boolean);
      if (lines.length < 2) return res.status(400).json({ message: "CSV must have header and at least one row" });

      const header = lines[0].toLowerCase().split(",").map((h: string) => h.trim().replace(/"/g, ""));
      const dateIdx = header.findIndex((h: string) => h.includes("date"));
      const descIdx = header.findIndex((h: string) => h.includes("desc") || h.includes("merchant") || h.includes("name") || h.includes("narration"));
      const amtIdx = header.findIndex((h: string) => h.includes("amount") || h.includes("debit") || h.includes("credit"));

      if (amtIdx === -1) return res.status(400).json({ message: "CSV must have an amount column" });

      const created: Expense[] = [];
      for (const line of lines.slice(1).slice(0, 100)) {
        const cols = line.split(",").map((c: string) => c.trim().replace(/"/g, ""));
        const rawAmount = cols[amtIdx]?.replace(/[$,\s]/g, "");
        const amount = parseFloat(rawAmount || "0");
        if (!amount || amount <= 0) continue;

        const description = descIdx >= 0 ? cols[descIdx] || "Bank Transaction" : "Bank Transaction";
        const rawDate = dateIdx >= 0 ? cols[dateIdx] : "";
        const parsedDate = new Date(rawDate);
        const date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

        const aiCat = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            { role: "system", content: "Categorize this bank transaction. Reply with ONLY one of: Food & Drink, Shopping, Transport, Entertainment, Health, Subscriptions, Other" },
            { role: "user", content: description },
          ],
          max_completion_tokens: 10,
        });
        const category = aiCat.choices[0]?.message?.content?.trim() || "Other";
        const roast = await generateRoast(description, Math.round(amount * 100), category, tone || "savage");

        const expense = await storage.createExpense({
          userId,
          amount: Math.round(amount * 100),
          description,
          date,
          category,
          roast,
          imageUrl: null,
          source: "bank_statement",
        });
        created.push(expense);
      }

      res.status(201).json({ imported: created.length, expenses: created });
    } catch (err) {
      console.error("CSV import error:", err);
      res.status(500).json({ message: "Failed to import CSV" });
    }
  });

  // ─── Expenses: Annual report (premium or hasAnnualReport) ────────
  app.post("/api/expenses/annual-report", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || (user.tier === "free" && !user.hasAnnualReport)) {
      return res.status(403).json({ message: "Annual Report requires purchase", code: "ANNUAL_REQUIRED" });
    }

    try {
      const allExpenses = await storage.getExpenses(userId);
      if (allExpenses.length < 3) {
        return res.status(400).json({ message: "Need at least a few transactions to generate an annual report" });
      }

      const categoryTotals: Record<string, number> = {};
      const monthlyTotals: Record<string, number> = {};

      for (const exp of allExpenses) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        const month = new Date(exp.date).toISOString().slice(0, 7);
        monthlyTotals[month] = (monthlyTotals[month] || 0) + exp.amount;
      }

      const totalSpend = allExpenses.reduce((s, e) => s + e.amount, 0);
      const top5Categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const worstMonth = Object.entries(monthlyTotals).sort((a, b) => b[1] - a[1])[0];
      const avgMonthly = totalSpend / Math.max(Object.keys(monthlyTotals).length, 1);
      const projection5yr = avgMonthly * 12 * 5;

      const summaryText = `
Total spending: $${(totalSpend / 100).toFixed(2)}
Top categories: ${top5Categories.map(([c, a]) => `${c} $${(a / 100).toFixed(2)}`).join(", ")}
Worst month: ${worstMonth?.[0]} with $${((worstMonth?.[1] || 0) / 100).toFixed(2)}
Average monthly spend: $${(avgMonthly / 100).toFixed(2)}
      `.trim();

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are generating a brutal, honest annual financial roast report. The user paid for this, so make it count. Be specific, savage, insightful, and ultimately motivating. Structure your response as JSON with these exact keys:
- roast: string (3-4 sentences of brutal honesty about their year of spending)
- behavioralAnalysis: string (2-3 sentences analyzing their spending patterns and what it says about them as a person)
- improvements: array of 3 strings (specific, actionable financial improvement suggestions)
All content must directly reference their actual spending data.`,
          },
          { role: "user", content: summaryText },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 600,
      });

      const aiData = JSON.parse(aiResponse.choices[0]?.message?.content || "{}");

      res.json({
        totalSpend,
        top5Categories: top5Categories.map(([cat, amt]) => ({ category: cat, amount: amt })),
        worstMonth: { month: worstMonth?.[0] || "", amount: worstMonth?.[1] || 0 },
        avgMonthlySpend: Math.round(avgMonthly),
        projection5yr: Math.round(projection5yr),
        roast: aiData.roast || "Your spending is a masterpiece of questionable decisions.",
        behavioralAnalysis: aiData.behavioralAnalysis || "The data reveals a complex relationship with money.",
        improvements: aiData.improvements || ["Save more", "Spend less", "Touch grass"],
      });
    } catch (err) {
      console.error("Annual report error:", err);
      res.status(500).json({ message: "Failed to generate annual report" });
    }
  });

  // ─── Expenses: Delete ────────────────────────────────────────────
  app.delete(buildUrl(api.expenses.delete.path).replace(":id", ":id"), isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    await storage.deleteExpense(Number(req.params.id), userId);
    res.status(204).send();
  });

  return httpServer;
}
