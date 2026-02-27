import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import express from "express";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.expenses.list.path, async (req, res) => {
    const expensesList = await storage.getExpenses();
    res.json(expensesList);
  });

  app.get(api.expenses.summary.path, async (req, res) => {
    const summary = await storage.getMonthlySummary();
    res.json(summary);
  });

  app.post(api.expenses.upload.path, express.json({ limit: "50mb" }), async (req: Request, res: Response) => {
    try {
      const input = api.expenses.upload.input.parse(req.body);
      
      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: "You are a sassy, mildly judgmental financial assistant. You analyze receipts or bank statements and extract the total amount (in cents), a short description, the date of purchase (ISO string), and a category. Most importantly, you must generate a funny, mild roast about this purchase."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the details of this expense and roast me for it. Respond with JSON in this format: { \"amount\": 1250, \"description\": \"Starbucks Coffee\", \"date\": \"2023-10-15T08:30:00Z\", \"category\": \"Food & Drink\", \"roast\": \"Wow, $12.50 for bean water? Your savings account is crying.\" }" },
              { type: "image_url", image_url: { url: input.image } }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });

      const resultText = response.choices[0]?.message?.content;
      if (!resultText) {
        throw new Error("No response from AI");
      }

      const extracted = JSON.parse(resultText);
      const parsedDate = new Date(extracted.date);
      const dateToUse = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

      const expense = await storage.createExpense({
        amount: Math.round(extracted.amount),
        description: extracted.description || "Unknown",
        date: dateToUse,
        category: extracted.category || "General",
        roast: extracted.roast || "I have no words.",
        imageUrl: null 
      });

      res.status(201).json(expense);
    } catch (err) {
      console.error("Upload error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error during upload" });
    }
  });

  // Seed DB if empty
  const expensesList = await storage.getExpenses();
  if (expensesList.length === 0) {
    await storage.createExpense({
      amount: 1500,
      description: "Artisan Avocado Toast",
      date: new Date(),
      category: "Food & Drink",
      roast: "You know you could buy a whole bag of avocados for that price, right?",
    });
    await storage.createExpense({
      amount: 12000,
      description: "Aesthetic Mechanical Keyboard",
      date: new Date(),
      category: "Electronics",
      roast: "Ah yes, because the loud clacking will definitely make you code faster.",
    });
  }

  return httpServer;
}
