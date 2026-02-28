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
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const FREE_UPLOAD_LIMIT = 1;

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
        return res.json({
          advice: "Upload some receipts first so I have something to judge.",
          topCategory: "Unknown",
          savingsPotential: 0,
          breakdown: [],
        });
      }

      const categoryTotals: Record<string, number> = {};
      const categoryMerchants: Record<string, string[]> = {};
      for (const exp of allExpenses) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        if (!categoryMerchants[exp.category]) categoryMerchants[exp.category] = [];
        if (!categoryMerchants[exp.category].includes(exp.description)) {
          categoryMerchants[exp.category].push(exp.description);
        }
      }

      const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "General";
      const totalSpend = allExpenses.reduce((s, e) => s + e.amount, 0);

      const categoryLines = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => {
          const merchants = categoryMerchants[cat]?.slice(0, 5).join(", ") || "";
          return `${cat}: $${(amt / 100).toFixed(2)} (merchants: ${merchants || "unknown"})`;
        })
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a sharp financial advisor. Analyze spending and return ONLY valid JSON — no markdown, no explanation.

Return this exact shape:
{
  "advice": "One punchy sentence (max 15 words) naming the #1 problem and what to do about it.",
  "topCategory": "top spending category name",
  "savingsPotential": <realistic savings in cents, 10-20% of total>,
  "breakdown": [
    {
      "category": "Category Name",
      "insight": "Max 8 words describing the issue (e.g. 'High-end gym eating your budget')",
      "alternatives": ["Brand — $X/mo", "Brand2 — $X/mo", "DIY option — free"],
      "potentialSaving": <realistic cents saved per month>
    }
  ]
}

Rules:
- insight: 1-2 direct sentences of advice for that specific category. Be specific, name the problem and what to change (e.g. "You're paying premium gym prices you likely don't need. Downgrade or go digital.")
- alternatives: short chip-style labels like "Planet Fitness — $10/mo" or "Home workouts — free" (max 6 words each)
- Include 2-4 alternatives per category
- Include every category with notable spend
- potentialSaving should be realistic`,
          },
          {
            role: "user",
            content: `Total spend: $${(totalSpend / 100).toFixed(2)}\n\nSpending breakdown:\n${categoryLines}`,
          },
        ],
        max_completion_tokens: 800,
      });

      let parsed: any;
      try {
        const raw = response.choices[0]?.message?.content || "{}";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { advice: "Spend less on the stuff you spend the most on.", topCategory, savingsPotential: Math.round(totalSpend * 0.15), breakdown: [] };
      }

      res.json({
        advice: parsed.advice || "Keep an eye on your top categories.",
        topCategory: parsed.topCategory || topCategory,
        savingsPotential: parsed.savingsPotential || Math.round(totalSpend * 0.15),
        breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown : [],
      });
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

  // ─── Shared: process a list of raw transactions into expenses ─────
  async function processTransactions(
    userId: string,
    transactions: { description: string; amount: number; date: string }[],
    tone: string
  ) {
    const created: Expense[] = [];
    for (const tx of transactions.slice(0, 100)) {
      if (!tx.amount || tx.amount <= 0) continue;
      const parsedDate = new Date(tx.date);
      const date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const aiCat = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: "Categorize this bank transaction. Reply with ONLY one of: Food & Drink, Shopping, Transport, Entertainment, Health, Subscriptions, Other" },
          { role: "user", content: tx.description },
        ],
        max_completion_tokens: 10,
      });
      const category = aiCat.choices[0]?.message?.content?.trim() || "Other";
      const roast = await generateRoast(tx.description, Math.round(tx.amount * 100), category, tone);
      const expense = await storage.createExpense({
        userId,
        amount: Math.round(tx.amount * 100),
        description: tx.description,
        date,
        category,
        roast,
        imageUrl: null,
        source: "bank_statement",
      });
      created.push(expense);
    }
    return created;
  }

  // ─── Expenses: Import statement (CSV / PDF / image) — premium ─────
  app.post("/api/expenses/import-csv", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") {
      return res.status(403).json({ message: "Statement import requires Premium", code: "PREMIUM_REQUIRED" });
    }

    const { csvData, data, format, tone } = req.body;
    const fmt: string = format || "csv";
    const toneVal = tone || "savage";

    try {
      // ── CSV ──────────────────────────────────────────────────────
      if (fmt === "csv") {
        const raw = csvData || data;
        if (!raw) return res.status(400).json({ message: "No data provided" });

        const lines = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);
        if (lines.length < 2) return res.status(400).json({ message: "CSV must have a header and at least one row" });

        const header = lines[0].toLowerCase().split(",").map((h: string) => h.trim().replace(/"/g, ""));
        const dateIdx = header.findIndex((h: string) => h.includes("date"));
        const descIdx = header.findIndex((h: string) => h.includes("desc") || h.includes("merchant") || h.includes("name") || h.includes("narration"));
        const amtIdx = header.findIndex((h: string) => h.includes("amount") || h.includes("debit") || h.includes("credit"));

        if (amtIdx === -1) return res.status(400).json({ message: "CSV must have an amount column" });

        const txs = lines.slice(1).map((line: string) => {
          const cols = line.split(",").map((c: string) => c.trim().replace(/"/g, ""));
          const rawAmt = cols[amtIdx]?.replace(/[$,\s]/g, "");
          const amount = parseFloat(rawAmt || "0");
          const description = descIdx >= 0 ? cols[descIdx] || "Bank Transaction" : "Bank Transaction";
          const date = dateIdx >= 0 ? cols[dateIdx] || "" : "";
          return { description, amount, date };
        });

        const created = await processTransactions(userId, txs, toneVal);
        return res.status(201).json({ imported: created.length, expenses: created });
      }

      // ── PDF ──────────────────────────────────────────────────────
      if (fmt === "pdf") {
        if (!data) return res.status(400).json({ message: "No PDF data provided" });
        const base64 = data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const parsed = await pdfParse(buffer);
        const pdfText = parsed.text?.slice(0, 8000) || "";
        if (!pdfText.trim()) return res.status(400).json({ message: "Could not extract text from PDF" });

        const extraction = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            {
              role: "system",
              content: `You are a bank statement parser. Extract all transactions from the text and return a JSON array.
Each item must have: { "description": string, "amount": number (positive, in dollars), "date": "YYYY-MM-DD" }.
Only include spending transactions (positive amounts). Skip refunds, deposits, and transfers in.
Return ONLY the JSON array, no other text.`,
            },
            { role: "user", content: pdfText },
          ],
        });

        let txs: { description: string; amount: number; date: string }[] = [];
        try {
          const raw = extraction.choices[0]?.message?.content?.trim() || "[]";
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "");
          txs = JSON.parse(cleaned);
        } catch {
          return res.status(400).json({ message: "Could not parse transactions from PDF" });
        }

        const created = await processTransactions(userId, txs, toneVal);
        return res.status(201).json({ imported: created.length, expenses: created });
      }

      // ── Image (JPEG / PNG / WebP / HEIC converted) ───────────────
      if (fmt === "image") {
        if (!data) return res.status(400).json({ message: "No image data provided" });

        const extraction = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            {
              role: "system",
              content: `You are a bank statement parser. Extract all transactions visible in this image and return a JSON array.
Each item must have: { "description": string, "amount": number (positive, in dollars), "date": "YYYY-MM-DD" }.
Only include spending transactions (positive amounts). Skip refunds, deposits, and transfers in.
Return ONLY the JSON array, no other text.`,
            },
            {
              role: "user",
              content: [{ type: "image_url", image_url: { url: data } }],
            },
          ],
        });

        let txs: { description: string; amount: number; date: string }[] = [];
        try {
          const raw = extraction.choices[0]?.message?.content?.trim() || "[]";
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "");
          txs = JSON.parse(cleaned);
        } catch {
          return res.status(400).json({ message: "Could not parse transactions from image" });
        }

        const created = await processTransactions(userId, txs, toneVal);
        return res.status(201).json({ imported: created.length, expenses: created });
      }

      return res.status(400).json({ message: "Unsupported format. Use csv, pdf, or image." });
    } catch (err) {
      console.error("Statement import error:", err);
      res.status(500).json({ message: "Failed to import statement" });
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
