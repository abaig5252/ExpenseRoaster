import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  registerAuthRoutes(app);

  app.get(api.expenses.list.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const list = await storage.getExpenses(userId);
    res.json(list);
  });

  app.get(api.expenses.summary.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const summary = await storage.getMonthlySummary(userId);
    res.json(summary);
  });

  app.get(api.expenses.monthlySeries.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const series = await storage.getMonthlySeries(userId);
    res.json(series);
  });

  app.get(api.expenses.financialAdvice.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const allExpenses = await storage.getExpenses(userId);

      if (allExpenses.length === 0) {
        return res.json({
          advice: "Upload some receipts first so I can roast your financial decisions properly.",
          topCategory: "Unknown",
          savingsPotential: 0,
        });
      }

      const categoryTotals: Record<string, number> = {};
      for (const exp of allExpenses) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      }
      const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "General";
      const totalSpend = allExpenses.reduce((s, e) => s + e.amount, 0);
      const savingsPotential = Math.round(totalSpend * 0.15);

      const summary = Object.entries(categoryTotals)
        .map(([cat, amt]) => `${cat}: $${(amt / 100).toFixed(2)}`)
        .join(", ");

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a brutally honest but secretly caring financial advisor with a sharp wit. You give REAL, actionable financial advice — but you're not afraid to call out bad spending. Be specific, direct, and mildly savage but ultimately helpful. Keep it to 2-3 punchy sentences.`,
          },
          {
            role: "user",
            content: `My spending by category: ${summary}. Top category is ${topCategory}. Give me sharp financial advice.`,
          },
        ],
        max_completion_tokens: 200,
      });

      const advice = response.choices[0]?.message?.content || "Spend less. Save more. Revolutionary concept, I know.";

      res.json({ advice, topCategory, savingsPotential });
    } catch (err) {
      console.error("Financial advice error:", err);
      res.status(500).json({ message: "Failed to generate financial advice" });
    }
  });

  app.post(api.expenses.upload.path, isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const input = api.expenses.upload.input.parse(req.body);

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a brutally savage, hilariously judgmental financial roaster. Your job is to extract expense data from a receipt or bank statement image AND deliver a SPICY roast. 

Rules for the roast:
- Be genuinely funny, not just snarky
- Reference the specific purchase or amount
- Go for the jugular — shame the lifestyle choice, the amount, the category, or all three
- Make it feel personal, like you've been watching them waste money all month
- Channel a mix of disappointed parent + savage comedian
- Never be cruel, just deliciously judgmental

Examples of good roasts:
- "$47 on sushi? Your ancestors survived famines and you're spending $12 on a single edamame."
- "Another DoorDash order? At this rate your delivery driver can afford a house before you can."
- "Gym membership AND ordering pizza 4 times this week? Bold strategy, king."`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the expense details and roast me. Respond ONLY with JSON: { "amount": <number in cents>, "description": "<short name>", "date": "<ISO date>", "category": "<Food & Drink|Shopping|Transport|Entertainment|Health|Subscriptions|Other>", "roast": "<your savage roast>" }`,
              },
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

      const expense = await storage.createExpense({
        userId,
        amount: Math.round(extracted.amount),
        description: extracted.description || "Unknown Purchase",
        date: dateToUse,
        category: extracted.category || "Other",
        roast: extracted.roast || "I'm speechless. And that's saying something.",
        imageUrl: null,
        source: "receipt",
      });

      res.status(201).json(expense);
    } catch (err) {
      console.error("Upload error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to process receipt" });
    }
  });

  app.post(api.expenses.addManual.path, isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const input = api.expenses.addManual.input.parse(req.body);

      const roastResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a savage but funny financial roaster. Roast this expense in ONE sharp, specific, funny sentence. Make it hurt just a little. Reference the amount and category.`,
          },
          {
            role: "user",
            content: `Expense: ${input.description}, $${(input.amount / 100).toFixed(2)}, category: ${input.category}`,
          },
        ],
        max_completion_tokens: 100,
      });

      const roast = roastResponse.choices[0]?.message?.content || "Wow. Just...wow.";

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
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to add expense" });
    }
  });

  app.delete(buildUrl(api.expenses.delete.path).replace(':id', ':id'), isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    await storage.deleteExpense(Number(req.params.id), userId);
    res.status(204).send();
  });

  return httpServer;
}
