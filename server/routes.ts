import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripe/stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { data: Buffer }) => { getText: () => Promise<{ text: string }> };
};

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const FREE_UPLOAD_LIMIT = 1;

const ROAST_PROMPTS: Record<string, string> = {
  savage: `You roast people's spending in 1-2 sentences — sharp, specific, a little mean but funny. Name the merchant, riff on the exact amount. Don't open with "You", "Oh", or the store name. Skip clichés like "bold choice", "treating yourself", "your wallet is crying". Just be unexpectedly funny — like a friend who's appalled but also kind of impressed.`,

  playful: `You're a friend who just saw the transaction and can't let it go — 1-2 sentences, cheeky and light. Name the merchant, do something funny with the exact amount. Don't open with "You", "Oh", or "So". No clichés like "bold choice" or "treating yourself". Keep it breezy, like something you'd actually text someone.`,

  supportive: `You're a warm but mildly horrified financial advisor — 1-2 sentences, calm and grounding. Name the merchant, give the amount a little context (what it could've been instead, or roughly how much time it cost to earn). Skip "it's okay", "no judgment", "treating yourself". Caring but quietly devastating.`,
};

function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

interface ExpenseForRoast {
  description: string;
  amountCents: number;
  category: string;
  date: Date | string;
}

async function generateMonthlyRoast(
  monthLabel: string,
  totalCents: number,
  expenses: ExpenseForRoast[],
  currency = "USD"
): Promise<string> {
  const total = (totalCents / 100).toFixed(2);
  const lines = expenses.map(e =>
    `${e.description} — ${(e.amountCents / 100).toFixed(2)} ${currency} (${e.category})`
  ).join('\n');

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `You write funny, cheeky spending summaries — 3-4 casual sentences, like a friend who's looked at your bank statement and has thoughts. Reference the specific merchants and amounts. Keep comparisons proportionate and realistic: if someone spent $100, compare it to things that actually cost around $100 (a nice dinner out, two months of Netflix, a decent pair of jeans) — not rent or a mortgage. If they spent $2000, then maybe rent is fair game. Be specific and grounded. No lists, no headers, just flowing sentences. Use ${currency}.`,
      },
      {
        role: "user",
        content: `${monthLabel}: ${total} ${currency} across ${expenses.length} receipt${expenses.length !== 1 ? 's' : ''}.\n\n${lines}`,
      },
    ],
    max_completion_tokens: 280,
  });
  return response.choices[0]?.message?.content ?? "Your bank account has filed a restraining order.";
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function generateRoast(description: string, amountCents: number, category: string, tone = "savage", _location?: string, currency = "USD", date?: Date | string): Promise<string> {
  const prompt = ROAST_PROMPTS[tone] || ROAST_PROMPTS.savage;
  let timeNote = "";
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      timeNote = ` on ${d.toLocaleString('en-US', { weekday: 'long' })} the ${ordinalSuffix(d.getDate())}`;
    }
  }
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: `${prompt} Currency: ${currency}. Use the local currency symbol. Make any comparisons specific to real things that cost similar amounts in the ${currency} region. NEVER mention city names, street addresses, or neighbourhoods.` },
      { role: "user", content: `Merchant: ${description}${timeNote}. Amount: ${(amountCents / 100).toFixed(2)} ${currency}. Category: ${category}. Roast this. 1-2 sentences, no filler.` },
    ],
    max_completion_tokens: 150,
  });
  return response.choices[0]?.message?.content || "Your accountant has left the chat.";
}

function getPriceForPlan(plan: string, prices: any[]): string | null {
  return prices.find((p: any) => p.metadata?.plan === plan)?.id || null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);

  // JWT_SECRET used by local auth routes below
  const JWT_SECRET = process.env.SESSION_SECRET || "fallback-dev-secret";

  // ─── Mobile token issuance ─────────────────────────────────────────
  // Fallback endpoint — mobile app normally gets a JWT via the OAuth callback redirect.
  // This endpoint allows token refresh for already-authenticated web sessions.
  app.post("/api/mobile/token", isAuthenticated, (req: any, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token });
  });

  // ─── Email Verification ────────────────────────────────────────────
  const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA";

  async function verifyCaptcha(token: string): Promise<boolean> {
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v1/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token }),
      });
      const data = await r.json() as { success: boolean };
      return data.success;
    } catch {
      return false;
    }
  }

  // ─── Local Auth: Register ────────────────────────────────────────
  app.post("/api/auth/local/register", async (req: any, res: Response) => {
    try {
      const { email, password, firstName } = req.body;
      if (!email || !password || !firstName) return res.status(400).json({ message: "Email, password and first name are required" });
      if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "An account with this email already exists" });
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createLocalUser({ email, passwordHash, firstName: firstName.trim() });
      const token = jwt.sign({ userId: user.id }, process.env.SESSION_SECRET || "secret", { expiresIn: "30d" });
      res.status(201).json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, tier: user.tier, emailVerified: user.emailVerified, onboardingComplete: user.onboardingComplete } });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // ─── Local Auth: Login ───────────────────────────────────────────
  app.post("/api/auth/local/login", async (req: any, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) return res.status(401).json({ message: "Invalid email or password" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });
      const token = jwt.sign({ userId: user.id }, process.env.SESSION_SECRET || "secret", { expiresIn: "30d" });
      res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, tier: user.tier, emailVerified: user.emailVerified, onboardingComplete: user.onboardingComplete } });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ─── Mobile Auth: GET-based endpoints for Replit dev proxy compatibility ──────
  // The Replit dev proxy rewrites POST/PATCH from external devices (Expo Go) to GET,
  // dropping the body. These GET endpoints read credentials from custom headers instead.

  app.get("/api/auth/mobile/register", async (req: any, res: Response) => {
    try {
      const email = req.headers["x-auth-email"] as string;
      const password = req.headers["x-auth-password"] as string;
      const firstName = req.headers["x-auth-firstname"] as string;
      if (!email || !password || !firstName) return res.status(400).json({ message: "Email, password and first name are required" });
      if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "An account with this email already exists" });
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createLocalUser({ email, passwordHash, firstName: firstName.trim() });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
      res.status(201).json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, tier: user.tier, emailVerified: user.emailVerified, onboardingComplete: user.onboardingComplete } });
    } catch (err) {
      console.error("Mobile register error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.get("/api/auth/mobile/login", async (req: any, res: Response) => {
    try {
      const email = req.headers["x-auth-email"] as string;
      const password = req.headers["x-auth-password"] as string;
      if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) return res.status(401).json({ message: "Invalid email or password" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
      res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, tier: user.tier, emailVerified: user.emailVerified, onboardingComplete: user.onboardingComplete } });
    } catch (err) {
      console.error("Mobile login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/mobile/forgot-password", async (req: any, res: Response) => {
    try {
      const email = req.headers["x-auth-email"] as string;
      if (!email) return res.json({ ok: true });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.json({ ok: true });
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await storage.setPasswordResetToken(user.id, token, expires);
      const resetUrl = `${process.env.APP_URL || `https://${req.headers.host}`}/reset-password?token=${token}`;
      const { getUncachableResendClient } = await import("./resend/resendClient");
      const resend = await getUncachableResendClient();
      await resend.emails.send({
        from: "Expense Roaster <admin@expenseroaster.com>",
        to: user.email!,
        subject: "Reset your Expense Roaster password",
        html: `
          <div style="background:#0A0A0A;color:#F0F0F0;font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;border:1px solid rgba(255,255,255,0.06)">
            <h2 style="color:#00E676;margin-top:0;font-size:22px">Expense Roaster 🔥</h2>
            <p style="margin:0 0 16px">You requested a password reset. Click the button below to set a new password.</p>
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#E91E8C,#00E676);color:#fff;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;margin:0 0 24px">Reset Password</a>
            <p style="color:#8A9099;font-size:13px;margin:0">This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>
          </div>
        `,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("Mobile forgot-password error:", err);
      res.status(500).json({ message: "Failed to send reset email" });
    }
  });

  // ─── Local Auth: Forgot password ────────────────────────────────
  app.post("/api/auth/local/forgot-password", async (req: any, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const user = await storage.getUserByEmail(email);
      // Always respond OK to prevent user enumeration
      if (!user) return res.json({ ok: true });
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.setPasswordResetToken(user.id, token, expires);
      const resetUrl = `${process.env.APP_URL || `https://${req.headers.host}`}/reset-password?token=${token}`;
      const { getUncachableResendClient } = await import("./resend/resendClient");
      const resend = await getUncachableResendClient();
      await resend.emails.send({
        from: "Expense Roaster <admin@expenseroaster.com>",
        to: user.email!,
        subject: "Reset your Expense Roaster password",
        html: `
          <div style="background:#0A0A0A;color:#F0F0F0;font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;border:1px solid rgba(255,255,255,0.06)">
            <h2 style="color:#00E676;margin-top:0;font-size:22px">Expense Roaster 🔥</h2>
            <p style="margin:0 0 16px">You requested a password reset. Click the button below to set a new password.</p>
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#E91E8C,#00E676);color:#fff;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;margin:0 0 24px">Reset Password</a>
            <p style="color:#8A9099;font-size:13px;margin:0">This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>
          </div>
        `,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("Forgot password error:", err);
      res.status(500).json({ message: "Failed to send reset email" });
    }
  });

  // ─── Local Auth: Reset password ─────────────────────────────────
  app.post("/api/auth/local/reset-password", async (req: any, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ message: "Token and password are required" });
      if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      const user = await storage.getUserByResetToken(token);
      if (!user) return res.status(400).json({ message: "Invalid or expired reset link" });
      if (user.passwordResetExpires && user.passwordResetExpires < new Date()) return res.status(400).json({ message: "Reset link has expired" });
      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updatePassword(user.id, passwordHash);
      res.json({ ok: true });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // ─── Local Auth: Validate reset token ───────────────────────────
  app.get("/api/auth/local/validate-reset-token", async (req: any, res: Response) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ valid: false });
    const user = await storage.getUserByResetToken(token as string);
    if (!user) return res.json({ valid: false });
    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) return res.json({ valid: false });
    res.json({ valid: true });
  });

  app.post("/api/auth/send-verification", isAuthenticated, async (req: any, res: Response) => {
    const { captchaToken } = req.body;
    if (!captchaToken) return res.status(400).json({ message: "CAPTCHA required" });
    const ok = await verifyCaptcha(captchaToken);
    if (!ok) return res.status(400).json({ message: "CAPTCHA verification failed" });

    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.emailVerified) return res.status(400).json({ message: "Email already verified" });
    if (!user.email) return res.status(400).json({ message: "No email on account" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await storage.setEmailVerificationCode(userId, code, expires);

    const { getUncachableResendClient } = await import("./resend/resendClient");
    const resend = await getUncachableResendClient();
    await resend.emails.send({
      from: "Expense Roaster <admin@expenseroaster.com>",
      to: user.email,
      subject: "Your Expense Roaster verification code",
      html: `
        <div style="background:#0A0A0A;color:#F0F0F0;font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;border:1px solid rgba(255,255,255,0.06)">
          <h2 style="color:#00E676;margin-top:0;font-size:22px">Expense Roaster 🔥</h2>
          <p style="margin:0 0 16px">Your email verification code is:</p>
          <div style="background:#1A1A1A;border:1px solid rgba(0,230,118,0.22);border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
            <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#00E676">${code}</span>
          </div>
          <p style="color:#8A9099;font-size:13px;margin:0">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    res.json({ ok: true });
  });

  app.post("/api/auth/verify-email", isAuthenticated, async (req: any, res: Response) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code required" });
    const userId = getUserId(req);
    const result = await storage.verifyEmailCode(userId, String(code).trim());
    if (result === "invalid") return res.status(400).json({ message: "Invalid code" });
    if (result === "expired") return res.status(400).json({ message: "Code expired — request a new one" });
    const user = await storage.getUser(userId);
    res.json({ user });
  });

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

  // ─── Update profile (onboarding, currency, name) ─────────────────
  app.patch("/api/me/profile", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().optional(),
      currency: z.string().min(2).max(5).optional(),
      onboardingComplete: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    const user = await storage.updateUserProfile(userId, parsed.data);
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

  // ─── Expenses: Monthly summary roast ────────────────────────────
  app.get("/api/expenses/monthly-roast", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") {
      return res.status(403).json({ message: "Monthly roast requires Premium" });
    }
    const { month, source } = req.query as { month?: string; source?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month param must be YYYY-MM" });
    }
    let all = await storage.getExpenses(userId);
    let filtered = all.filter(e => {
      const d = e.date instanceof Date ? e.date : new Date(String(e.date));
      return d.toISOString().slice(0, 7) === month;
    });
    if (source) filtered = filtered.filter(e => e.source === source);
    if (filtered.length === 0) return res.json({ roast: null, total: 0, count: 0 });
    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    // Derive currency from the expenses themselves, not the user profile
    const currencyCounts: Record<string, number> = {};
    for (const e of filtered) {
      const c = (e.currency as string | null | undefined) ?? user.currency ?? "USD";
      currencyCounts[c] = (currencyCounts[c] || 0) + 1;
    }
    const currency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? user.currency ?? "USD";
    const [yr, mo] = month.split("-");
    const monthLabel = new Date(Number(yr), Number(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
    const expensesForRoast: ExpenseForRoast[] = filtered.map(e => ({
      description: e.description,
      amountCents: e.amount,
      category: e.category,
      date: e.date instanceof Date ? e.date : new Date(String(e.date)),
    }));
    const roast = await generateMonthlyRoast(monthLabel, total, expensesForRoast, currency);
    res.json({ roast, total, count: filtered.length });
  });

  // ─── Expenses: Financial advice (premium) ───────────────────────
  app.get(api.expenses.financialAdvice.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") {
      return res.status(403).json({ message: "Financial advice requires Premium" });
    }
    try {
      const { month, year, categories, source } = req.query as { month?: string; year?: string; categories?: string; source?: string };
      const filterCategories = categories ? categories.split(",").map((c: string) => c.trim()).filter(Boolean) : [];

      let allExpenses = await storage.getExpenses(userId);

      // Filter by source (receipt / bank_statement)
      if (source === "receipt") {
        allExpenses = allExpenses.filter(e => e.source === "receipt");
      } else if (source === "bank_statement") {
        allExpenses = allExpenses.filter(e => e.source === "bank_statement" || e.source === "manual");
      }

      // Filter by month, year, or categories if provided
      if (month) {
        allExpenses = allExpenses.filter(e => {
          const d = e.date instanceof Date ? e.date : new Date(e.date);
          return d.toISOString().slice(0, 7) === month;
        });
      } else if (year) {
        allExpenses = allExpenses.filter(e => {
          const d = e.date instanceof Date ? e.date : new Date(e.date);
          return String(d.getFullYear()) === year;
        });
      }
      if (filterCategories.length > 0) {
        allExpenses = allExpenses.filter(e => filterCategories.includes(e.category));
      }

      if (allExpenses.length === 0) {
        return res.json({
          advice: "No expenses match this filter — try a different time period or category.",
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

      const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
      const topCategory = sortedCats[0]?.[0] || "General";
      const totalSpend = allExpenses.reduce((s, e) => s + e.amount, 0);

      // Derive currency from the most common currency in the filtered expenses
      const currencyFreq: Record<string, number> = {};
      for (const exp of allExpenses) {
        const c = (exp as any).currency || user?.currency || "USD";
        currencyFreq[c] = (currencyFreq[c] || 0) + exp.amount;
      }
      const adviceCurrency = Object.entries(currencyFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || user?.currency || "USD";

      const categoryLines = sortedCats
        .map(([cat, amt]) => {
          const merchants = categoryMerchants[cat]?.slice(0, 6).join(", ") || "various";
          return `- ${cat}: ${(amt / 100).toFixed(2)} ${adviceCurrency} (merchants: ${merchants})`;
        })
        .join("\n");

      // Build time context string for the prompt
      let timeContext = "all-time";
      if (month) timeContext = new Date(month + "-02").toLocaleString("en-US", { month: "long", year: "numeric" });
      else if (year) timeContext = year;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a brutally honest, deeply knowledgeable financial advisor analyzing REAL spending data. You know local prices, brands, and alternatives for every major region.

The user's currency is ${adviceCurrency}. All amounts must be in ${adviceCurrency} with realistic local pricing.
Time period: ${timeContext}.

You MUST return ONLY a valid JSON object — no markdown, no explanation, no code fences. The JSON MUST contain a "breakdown" array with one entry per category listed by the user. NEVER return an empty breakdown.

Required JSON shape:
{
  "advice": "One punchy sentence (max 20 words) identifying the #1 spending problem and the single best action to fix it.",
  "topCategory": "name of the highest-spend category",
  "savingsPotential": <total realistic monthly savings in cents across all categories, 10-25% of total>,
  "breakdown": [
    {
      "category": "exact category name from input",
      "roast": "One savage funny sentence roasting this specific spending — reference the actual merchant names or amounts. Make it sting.",
      "insight": "2-3 SPECIFIC, ACTIONABLE sentences. State the exact problem (e.g. 'You're spending X/mo on coffee alone'). Give a concrete fix with a specific number or action. Name a real alternative vendor or habit.",
      "alternatives": [
        "Real cheaper option — ~X ${adviceCurrency}",
        "Another real option — ~X ${adviceCurrency}",
        "DIY / free option — free"
      ],
      "potentialSaving": <realistic cents saved per month if they follow the advice>
    }
  ]
}

STRICT RULES FOR BREAKDOWN:
- Every category in the input MUST appear in breakdown. No exceptions.
- roast: reference specific merchant names from the data, be funny and sharp
- insight: be concrete. Not "consider reducing" — say "cancel X and switch to Y, saving ~Z ${adviceCurrency}/mo"
- alternatives: use REAL brand names that exist in the ${adviceCurrency} region. Examples:
  * Dining (CAD): "Freshii — ~$12 CAD", "Meal prep Sunday — ~$8/meal", "Grocery store sushi — ~$10 CAD"
  * Coffee (CAD): "Tim Hortons — ~$2.50 CAD", "Nespresso pods — ~$0.90/cup", "French press + bulk beans — ~$0.30/cup"
  * Coffee (USD): "McDonald's McCafe — ~$2 USD", "Keurig pods — ~$0.75/cup", "Home brew — ~$0.20/cup"
  * Subscriptions: "Share Netflix plan", "Bundle Disney+/Hulu/ESPN — ~$14.99 USD/mo", "Cancel and rotate"
  * Fitness: "Planet Fitness — ~$10/mo", "YouTube workouts — free", "City rec center — ~$25/mo"
  * Groceries: "ALDI / Lidl — 20% cheaper", "Store-brand swap", "Costco bulk — saves ~30%"
  * Gas/Transport: "GasBuddy app", "Carpool", "Transit pass"
- potentialSaving: be realistic. For a $400 dining habit, don't say $380 savings. Say $80-$150.
- LOCATION RULE: Do NOT mention city names, street addresses, neighbourhoods, or any geographic location in roast or insight text unless that location appears in the merchant name itself.`,
          },
          {
            role: "user",
            content: `Analyze this ${timeContext} spending for a ${adviceCurrency} user and return the JSON with a COMPLETE breakdown for every category:

Total: ${(totalSpend / 100).toFixed(2)} ${adviceCurrency}
Categories:
${categoryLines}

Remember: breakdown array must have ${sortedCats.length} entries, one per category above.`,
          },
        ],
        max_completion_tokens: 1600,
      });

      let parsed: any;
      try {
        const raw = response.choices[0]?.message?.content || "{}";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Financial advice JSON parse error:", parseErr);
        // Build a fallback breakdown from category data so the card is never blank
        const fallbackBreakdown = sortedCats.map(([cat, amt]) => ({
          category: cat,
          roast: `${cat} is eating ${(amt / 100).toFixed(2)} ${adviceCurrency} of your budget. Bold choice.`,
          insight: `You spent ${(amt / 100).toFixed(2)} ${adviceCurrency} on ${cat}. Look for cheaper alternatives or reduce frequency to cut this category by 15-20%.`,
          alternatives: ["Compare prices before buying", "Buy in bulk when on sale", "Look for discount codes"],
          potentialSaving: Math.round(amt * 0.15),
        }));
        parsed = {
          advice: `Your biggest drain is ${topCategory} — target it first.`,
          topCategory,
          savingsPotential: Math.round(totalSpend * 0.15),
          breakdown: fallbackBreakdown,
        };
      }

      // Ensure breakdown is always an array and has content
      let breakdown = Array.isArray(parsed.breakdown) ? parsed.breakdown : [];
      if (breakdown.length === 0) {
        breakdown = sortedCats.map(([cat, amt]) => ({
          category: cat,
          roast: `${(amt / 100).toFixed(2)} ${adviceCurrency} on ${cat}. Your wallet is crying.`,
          insight: `Cut ${cat} spending by reviewing each merchant and eliminating low-value purchases. A 15% reduction here saves ${(amt * 0.15 / 100).toFixed(2)} ${adviceCurrency}/mo.`,
          alternatives: ["Shop around for better deals", "Set a monthly budget cap", "Find free alternatives"],
          potentialSaving: Math.round(amt * 0.15),
        }));
      }

      // Sanity clamp: savings can never exceed what was actually spent in the filtered period.
      // Per-category: max 40% of that category's real spend.
      // Total: max 30% of total real spend.
      const MAX_CAT_RATIO = 0.40;
      const MAX_TOTAL_RATIO = 0.30;
      breakdown = breakdown.map((item: any) => {
        const catSpend = categoryTotals[item.category] ?? totalSpend;
        const maxCatSaving = Math.round(catSpend * MAX_CAT_RATIO);
        return {
          ...item,
          potentialSaving: Math.min(Math.max(0, Number(item.potentialSaving) || 0), maxCatSaving),
        };
      });

      const savingsSumFromBreakdown = breakdown.reduce((s: number, b: any) => s + b.potentialSaving, 0);
      const maxTotalSaving = Math.round(totalSpend * MAX_TOTAL_RATIO);
      const savingsPotential = Math.min(
        Math.max(0, Number(parsed.savingsPotential) || savingsSumFromBreakdown),
        maxTotalSaving,
      );

      res.json({
        advice: parsed.advice || `${topCategory} is your biggest problem — start there.`,
        topCategory: parsed.topCategory || topCategory,
        savingsPotential,
        breakdown,
        timeContext,
      });
    } catch (err) {
      console.error("Financial advice error:", err);
      res.status(500).json({ message: "Failed to generate financial advice" });
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
      // Convert HEIC/HEIF to JPEG server-side using sharp (browser heic2any is unreliable)
      let imageUrl = input.image;
      if (/^data:image\/(heic|heif)/i.test(imageUrl)) {
        const base64Data = imageUrl.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const jpegBuffer = await sharp(buffer).rotate().jpeg({ quality: 90 }).toBuffer();
        imageUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
      }
      const systemPrompt = `${ROAST_PROMPTS[tone] || ROAST_PROMPTS.savage}

Extract expense data from this receipt image. Keep the receipt's native currency — do NOT convert. For the roast field, be specific to this merchant and this amount — not generic. No addresses or neighbourhoods.`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Carefully read this receipt and extract the expense details.

FINDING THE TOTAL AMOUNT (most important):
1. Locate the final "Total", "Grand Total", "Amount Due", "Amount Paid", or "Balance Due" line — NOT "Subtotal".
2. Read the printed number on that line. This printed total is the ground truth. Report exactly what it says.
3. As a sanity check only: if you can clearly read all line items and taxes, sum them. If your sum is MORE THAN 10% different from the printed total, you may have picked the wrong line (e.g., subtotal instead of total) — re-examine and pick the correct FINAL total.
4. Do NOT substitute your own arithmetic for the printed total. The printed total is always preferred.

Convert the total to cents in the receipt's own currency (multiply × 100, round to nearest integer).

Respond ONLY with this JSON (no markdown, no extra keys):
{
  "amount": <grand total in cents, integer>,
  "currency": "<3-letter ISO currency code from the receipt, e.g. USD, EUR, GBP, AUD>",
  "description": "<merchant name — short, e.g. 'Walmart', 'Starbucks'>",
  "date": "<ISO date from receipt, e.g. 2024-03-15>",
  "category": "<Pick the single best match — Food & Drink (restaurants, cafes, bars, takeout, food delivery), Groceries (supermarkets, Walmart, Costco, grocery stores), Shopping (clothing, retail, electronics, department stores, Amazon, general merchandise), Transport (gas stations, parking, Uber, Lyft, taxi, bus, subway, train, tolls, car wash), Travel (flights, hotels, Airbnb, car rental, accommodation), Entertainment (movies, concerts, events, gaming, theme parks, sports, nightlife), Health & Fitness (pharmacy, gym, doctor, dentist, spa, beauty, personal care), Subscriptions (recurring monthly/annual services, streaming, software, apps, memberships), Other (only if nothing above fits)>",
  "location": "<city and country from receipt, or null>",
  "roast": "<1-2 sentences roasting this specific merchant and exact amount — cheeky and specific, not generic. No 'bold choice', no 'treating yourself'. Don't start with 'You'. No addresses or neighbourhoods.>"
}` },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const resultText = aiResponse.choices[0]?.message?.content;
      if (!resultText) throw new Error("No AI response");

      const extracted = JSON.parse(resultText);

      const parsedDate = new Date(extracted.date);
      const dateToUse = isNaN(parsedDate.getTime()) || parsedDate.getFullYear() < 1990 ? new Date() : parsedDate;

      // Increment upload count regardless of tier
      await storage.incrementMonthlyUpload(userId);

      const detectedCurrency = (extracted.currency || "USD").toUpperCase();

      // For free users: return roast data but don't store
      if (isFree) {
        return res.status(201).json({
          id: -1,
          userId,
          amount: Math.round(extracted.amount),
          currency: detectedCurrency,
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
        currency: detectedCurrency,
      });

      res.status(201).json(expense);
    } catch (err) {
      console.error("Upload error:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to process receipt" });
    }
  });

  // ─── Expenses: Preview receipt (extract without storing) ──────────
  app.post("/api/expenses/preview-receipt", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const user = await storage.checkAndResetMonthlyUpload(userId);
      const isFree = user.tier === "free";
      if (isFree && user.monthlyUploadCount >= FREE_UPLOAD_LIMIT) {
        return res.status(403).json({ message: `Free tier limit reached.`, code: "UPLOAD_LIMIT_REACHED" });
      }
      const tone = req.body.tone || "savage";
      const input = api.expenses.upload.input.parse(req.body);
      let imageUrl = input.image;
      if (/^data:image\/(heic|heif)/i.test(imageUrl)) {
        const base64Data = imageUrl.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const jpegBuffer = await sharp(buffer).rotate().jpeg({ quality: 90 }).toBuffer();
        imageUrl = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
      }
      const systemPrompt = `${ROAST_PROMPTS[tone] || ROAST_PROMPTS.savage}\n\nExtract expense data from this receipt image. Keep the receipt's native currency — do NOT convert. For the roast field, be specific to this merchant and amount. No addresses or neighbourhoods.`;
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: `Carefully read this receipt. Find the final "Total", "Grand Total", "Amount Due", or "Amount Paid" line — NOT Subtotal. Keep the receipt's own currency.\n\nRespond ONLY with this JSON:\n{\n  "amount": <cents integer>,\n  "currency": "<3-letter ISO code from receipt, e.g. USD, EUR, GBP, AUD>",\n  "description": "<short merchant name>",\n  "date": "<ISO date e.g. 2024-03-15>",\n  "category": "<Pick the single best match — Food & Drink (restaurants, cafes, bars, takeout, food delivery), Groceries (supermarkets, Walmart, Costco, grocery stores), Shopping (clothing, retail, electronics, department stores, Amazon, general merchandise), Transport (gas stations, parking, Uber, Lyft, taxi, bus, subway, train, tolls, car wash), Travel (flights, hotels, Airbnb, car rental, accommodation), Entertainment (movies, concerts, events, gaming, theme parks, sports, nightlife), Health & Fitness (pharmacy, gym, doctor, dentist, spa, beauty, personal care), Subscriptions (recurring monthly/annual services, streaming, software, apps, memberships), Other (only if nothing above fits)>",\n  "roast": "<1-2 cheeky sentences about this merchant and exact amount>"\n}` },
            { type: "image_url", image_url: { url: imageUrl } },
          ]},
        ],
        response_format: { type: "json_object" },
      });
      const resultText = aiResponse.choices[0]?.message?.content;
      if (!resultText) throw new Error("No AI response");
      const extracted = JSON.parse(resultText);
      const parsedDate = new Date(extracted.date);
      const dateToUse = isNaN(parsedDate.getTime()) || parsedDate.getFullYear() < 1990 ? new Date() : parsedDate;
      res.json({
        amount: Math.round(extracted.amount),
        currency: (extracted.currency || "USD").toUpperCase(),
        description: extracted.description || "Unknown Purchase",
        date: dateToUse.toISOString(),
        category: extracted.category || "Other",
        roast: extracted.roast || "I'm speechless.",
      });
    } catch (err) {
      console.error("Preview receipt error:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to analyse receipt" });
    }
  });

  // ─── Expenses: Confirm receipt (store already-extracted data) ─────
  app.post("/api/expenses/confirm-receipt", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      let user = await storage.checkAndResetMonthlyUpload(userId);
      const isFree = user.tier === "free";
      if (isFree && user.monthlyUploadCount >= FREE_UPLOAD_LIMIT) {
        return res.status(403).json({ message: `Free tier limit reached.`, code: "UPLOAD_LIMIT_REACHED" });
      }
      const { amount, description, date, category, roast, currency: bodyCurrency } = req.body;
      if (!amount || !description || !date || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const confirmCurrency = bodyCurrency || "USD";
      await storage.incrementMonthlyUpload(userId);
      if (isFree) {
        return res.status(201).json({
          id: -1, userId, amount: Math.round(amount), description, date,
          category, roast: roast || "I'm speechless.", imageUrl: null, source: "receipt",
          currency: confirmCurrency,
          ephemeral: true, uploadsUsed: user.monthlyUploadCount + 1, uploadsLimit: FREE_UPLOAD_LIMIT,
        });
      }
      const expense = await storage.createExpense({
        userId, amount: Math.round(amount), description,
        date: new Date(date), category, roast: roast || "I'm speechless.", imageUrl: null, source: "receipt",
        currency: confirmCurrency,
      });
      res.status(201).json(expense);
    } catch (err) {
      console.error("Confirm receipt error:", err);
      res.status(500).json({ message: "Failed to confirm receipt" });
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
      const manualCurrency = input.currency || "USD";
      const roast = await generateRoast(input.description, input.amount, input.category, tone, undefined, manualCurrency, new Date(input.date));

      const expense = await storage.createExpense({
        userId,
        amount: Math.round(input.amount),
        description: input.description,
        date: new Date(input.date),
        category: input.category,
        roast,
        imageUrl: null,
        source: input.source,
        currency: manualCurrency,
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
    tone: string,
    location?: string,
    currency = "USD"
  ) {
    const created: Expense[] = [];
    for (const tx of transactions.slice(0, 100)) {
      if (!tx.amount || tx.amount <= 0) continue;
      const parsedDate = new Date(tx.date);
      const date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const aiCat = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: `Categorize this bank transaction. Reply with ONLY one of these exact values — pick the best match:
- Food & Drink: restaurants, cafes, bars, takeout, food delivery, fast food
- Groceries: supermarkets, Walmart, Costco, grocery stores, bulk food
- Shopping: clothing, retail, electronics, department stores, Amazon, general merchandise
- Transport: gas stations, parking, Uber, Lyft, taxi, bus, subway, train, tolls, car wash
- Travel: flights, hotels, Airbnb, car rental, accommodation, travel agencies
- Entertainment: movies, concerts, events, gaming, theme parks, sports, nightlife
- Health & Fitness: pharmacy, gym, doctor, dentist, spa, beauty salon, personal care
- Subscriptions: recurring monthly/annual services, streaming, software, apps, memberships
- Other: only if nothing above clearly fits` },
          { role: "user", content: tx.description },
        ],
        max_completion_tokens: 10,
      });
      const category = aiCat.choices[0]?.message?.content?.trim() || "Other";
      const roast = await generateRoast(tx.description, Math.round(tx.amount * 100), category, tone, location, currency, date);
      const expense = await storage.createExpense({
        userId,
        amount: Math.round(tx.amount * 100),
        description: tx.description,
        date,
        category,
        roast,
        imageUrl: null,
        source: "bank_statement",
        currency,
      });
      created.push(expense);
    }
    return created;
  }

  // ─── Expenses: Preview statement (parse only, no save) ─────────────
  app.post("/api/expenses/preview-statement", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") {
      return res.status(403).json({ message: "Statement import requires Premium", code: "PREMIUM_REQUIRED" });
    }
    const { data, format, currency: bodyCurrency } = req.body;
    const fmt: string = format || "pdf";
    const userCurrency = bodyCurrency || user.currency || "USD";

    try {
      let txs: { description: string; amount: number; date: string }[] = [];
      let statementLocation: string | undefined;

      if (fmt === "pdf") {
        if (!data) return res.status(400).json({ message: "No PDF data provided" });
        const base64 = data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        const pdfText = parsed.text?.slice(0, 8000) || "";
        if (!pdfText.trim()) return res.status(400).json({ message: "Could not extract text from PDF" });
        const extraction = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            { role: "system", content: `You are a bank statement parser. Extract all transactions from the text and return a JSON object with two keys:\n1. "location": the account holder's city and country (e.g. "Toronto, Canada"), or null.\n2. "transactions": a JSON array where each item has: { "description": string, "amount": number (positive, in ${userCurrency}), "date": "YYYY-MM-DD" }.\nOnly include spending transactions. Skip refunds, deposits, and transfers in.\nReturn ONLY valid JSON, no other text.` },
            { role: "user", content: pdfText },
          ],
          response_format: { type: "json_object" },
        });
        try {
          const raw = extraction.choices[0]?.message?.content?.trim() || "{}";
          const p2 = JSON.parse(raw);
          txs = Array.isArray(p2.transactions) ? p2.transactions : [];
          statementLocation = p2.location || undefined;
        } catch { return res.status(400).json({ message: "Could not parse transactions from PDF" }); }
      } else if (fmt === "image") {
        if (!data) return res.status(400).json({ message: "No image data provided" });
        const extraction = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            { role: "system", content: `You are a bank statement parser. Extract all transactions visible in this image and return a JSON object with two keys:\n1. "location": the account holder's city and country (e.g. "Mumbai, India"), or null.\n2. "transactions": a JSON array where each item has: { "description": string, "amount": number (positive, in ${userCurrency}), "date": "YYYY-MM-DD" }.\nOnly include spending transactions. Skip refunds, deposits, and transfers in.\nReturn ONLY valid JSON, no other text.` },
            { role: "user", content: [{ type: "image_url", image_url: { url: data } }] },
          ],
          response_format: { type: "json_object" },
        });
        try {
          const raw = extraction.choices[0]?.message?.content?.trim() || "{}";
          const p2 = JSON.parse(raw);
          txs = Array.isArray(p2.transactions) ? p2.transactions : [];
          statementLocation = p2.location || undefined;
        } catch { return res.status(400).json({ message: "Could not parse transactions from image" }); }
      } else {
        return res.status(400).json({ message: "Unsupported format." });
      }

      // Detect the most common month in the extracted transactions
      const monthCounts: Record<string, number> = {};
      for (const tx of txs) {
        const m = (tx.date || "").slice(0, 7);
        if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
      }
      const detectedMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
        || new Date().toISOString().slice(0, 7);

      return res.json({ transactions: txs, detectedMonth, transactionCount: txs.length, location: statementLocation || null });
    } catch (err) {
      console.error("Statement preview error:", err);
      res.status(500).json({ message: "Failed to preview statement" });
    }
  });

  // ─── Expenses: Import statement (PDF / image) — premium ─────
  app.post("/api/expenses/import-csv", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || user.tier === "free") {
      return res.status(403).json({ message: "Statement import requires Premium", code: "PREMIUM_REQUIRED" });
    }

    const { data, format, tone, currency: bodyCurrency, transactions: preParsed, month } = req.body;
    const fmt: string = format || "pdf";
    const toneVal = tone || "savage";
    const userCurrency = bodyCurrency || user.currency || "USD";

    // ── Pre-parsed path: transactions already extracted, just save+roast ──
    if (Array.isArray(preParsed) && preParsed.length > 0) {
      try {
        let txs = preParsed as { description: string; amount: number; date: string }[];
        if (month) {
          const [yr, mo] = month.split('-').map(Number);
          const daysInMonth = new Date(yr, mo, 0).getDate();
          txs = txs.map(tx => {
            const day = Math.min(Number((tx.date || "01").slice(8, 10)) || 1, daysInMonth);
            return { ...tx, date: `${yr}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
          });
        }
        const created = await processTransactions(userId, txs, toneVal, undefined, userCurrency);
        return res.status(201).json({ imported: created.length, expenses: created });
      } catch (err) {
        console.error("Statement import error (pre-parsed):", err);
        return res.status(500).json({ message: "Failed to import statement" });
      }
    }

    try {
      // ── PDF ──────────────────────────────────────────────────────
      if (fmt === "pdf") {
        if (!data) return res.status(400).json({ message: "No PDF data provided" });
        const base64 = data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        const pdfText = parsed.text?.slice(0, 8000) || "";
        if (!pdfText.trim()) return res.status(400).json({ message: "Could not extract text from PDF" });

        const extraction = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            {
              role: "system",
              content: `You are a bank statement parser. Extract all transactions from the text and return a JSON object with two keys:
1. "location": the account holder's city and country inferred from the statement header, bank address, or merchant names (e.g. "Toronto, Canada"), or null if not determinable.
2. "transactions": a JSON array where each item has: { "description": string, "amount": number (positive, in ${userCurrency}), "date": "YYYY-MM-DD" }.
Only include spending transactions (positive amounts). Skip refunds, deposits, and transfers in.
Return ONLY valid JSON, no other text.`,
            },
            { role: "user", content: pdfText },
          ],
          response_format: { type: "json_object" },
        });

        let txs: { description: string; amount: number; date: string }[] = [];
        let statementLocation: string | undefined;
        try {
          const raw = extraction.choices[0]?.message?.content?.trim() || "{}";
          const parsed2 = JSON.parse(raw);
          txs = Array.isArray(parsed2.transactions) ? parsed2.transactions : Array.isArray(parsed2) ? parsed2 : [];
          statementLocation = parsed2.location || undefined;
        } catch {
          return res.status(400).json({ message: "Could not parse transactions from PDF" });
        }

        const created = await processTransactions(userId, txs, toneVal, statementLocation, userCurrency);
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
              content: `You are a bank statement parser. Extract all transactions visible in this image and return a JSON object with two keys:
1. "location": the account holder's city and country inferred from the statement header, bank address, or merchant names (e.g. "Mumbai, India"), or null if not determinable.
2. "transactions": a JSON array where each item has: { "description": string, "amount": number (positive, in ${userCurrency}), "date": "YYYY-MM-DD" }.
Only include spending transactions (positive amounts). Skip refunds, deposits, and transfers in.
Return ONLY valid JSON, no other text.`,
            },
            {
              role: "user",
              content: [{ type: "image_url", image_url: { url: data } }],
            },
          ],
          response_format: { type: "json_object" },
        });

        let txs: { description: string; amount: number; date: string }[] = [];
        let statementLocation: string | undefined;
        try {
          const raw = extraction.choices[0]?.message?.content?.trim() || "{}";
          const parsed2 = JSON.parse(raw);
          txs = Array.isArray(parsed2.transactions) ? parsed2.transactions : Array.isArray(parsed2) ? parsed2 : [];
          statementLocation = parsed2.location || undefined;
        } catch {
          return res.status(400).json({ message: "Could not parse transactions from image" });
        }

        const created = await processTransactions(userId, txs, toneVal, statementLocation, userCurrency);
        return res.status(201).json({ imported: created.length, expenses: created });
      }

      return res.status(400).json({ message: "Unsupported format. Use pdf or image." });
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
      const merchantSpend: Record<string, { total: number; count: number }> = {};

      for (const exp of allExpenses) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        const month = new Date(exp.date).toISOString().slice(0, 7);
        monthlyTotals[month] = (monthlyTotals[month] || 0) + exp.amount;
        const merchant = exp.description || "Unknown";
        if (!merchantSpend[merchant]) merchantSpend[merchant] = { total: 0, count: 0 };
        merchantSpend[merchant].total += exp.amount;
        merchantSpend[merchant].count += 1;
      }

      const totalSpend = allExpenses.reduce((s, e) => s + e.amount, 0);
      const top5Categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const sortedMonths = Object.entries(monthlyTotals).sort((a, b) => a[0].localeCompare(b[0]));
      const worstMonth = [...sortedMonths].sort((a, b) => b[1] - a[1])[0];
      const bestMonth = [...sortedMonths].sort((a, b) => a[1] - b[1])[0];
      const avgMonthly = totalSpend / Math.max(sortedMonths.length, 1);
      const projection5yr = avgMonthly * 12 * 5;
      const top10Merchants = Object.entries(merchantSpend)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10);

      // Spending trend: compare first vs second half of months
      const half = Math.floor(sortedMonths.length / 2);
      const firstHalfAvg = half > 0 ? sortedMonths.slice(0, half).reduce((s, [, v]) => s + v, 0) / half : avgMonthly;
      const secondHalfAvg = half > 0 ? sortedMonths.slice(-half).reduce((s, [, v]) => s + v, 0) / half : avgMonthly;
      const trendDir = secondHalfAvg > firstHalfAvg * 1.05 ? "increasing" : secondHalfAvg < firstHalfAvg * 0.95 ? "decreasing" : "flat";

      // Derive currency from most-spent-in currency
      const currencySpend: Record<string, number> = {};
      for (const exp of allExpenses) {
        const c = ((exp as any).currency || "USD").toUpperCase();
        currencySpend[c] = (currencySpend[c] || 0) + exp.amount;
      }
      const annualCurrency = Object.entries(currencySpend).sort((a, b) => b[1] - a[1])[0]?.[0] || "USD";

      // Full transaction list for AI deep analysis (cap at 300 to keep prompt reasonable)
      const txList = allExpenses
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 300)
        .map(e => `${e.date}|${e.description || "Unknown"}|${(e.amount / 100).toFixed(2)}|${e.category}`)
        .join("\n");

      const summaryText = `FULL TRANSACTION LOG (${allExpenses.length} transactions, format: date|merchant|amount|category):
${txList}

AGGREGATED STATS:
Currency: ${annualCurrency}
Total spending: ${(totalSpend / 100).toFixed(2)} ${annualCurrency}
Transaction count: ${allExpenses.length}
Top categories: ${top5Categories.map(([c, a]) => `${c}: ${(a / 100).toFixed(2)} ${annualCurrency}`).join(", ")}
Best month: ${bestMonth?.[0]} — ${((bestMonth?.[1] || 0) / 100).toFixed(2)} ${annualCurrency}
Worst month: ${worstMonth?.[0]} — ${((worstMonth?.[1] || 0) / 100).toFixed(2)} ${annualCurrency}
Average monthly spend: ${(avgMonthly / 100).toFixed(2)} ${annualCurrency}
Spending trend (first half vs second half): ${trendDir}
Top 10 merchants by spend: ${top10Merchants.map(([name, d]) => `${name} ${(d.total / 100).toFixed(2)} ${annualCurrency} (${d.count}x)`).join("; ")}`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are the world's most insightful (and entertainingly savage) financial analyst. The user paid for this premium annual report — make it thorough, specific, fun and genuinely useful. You have access to every single transaction. Research real alternatives and savings strategies specific to ${annualCurrency} users.

Respond ONLY with valid JSON with exactly these keys:

- "roast": string — 5-6 sentences of savage but accurate annual roast. Reference specific merchant names, exact amounts, and patterns you spotted.
- "spendingPersonality": object — { "title": string (a fun archetype, max 5 words, e.g. "The Subscription Hoarder"), "description": string (2 sentences explaining this type based on actual data) }
- "behavioralAnalysis": string — 4-5 sentences of deep analysis: what the spending patterns reveal about this person's lifestyle, priorities, emotional triggers, and habits.
- "monthlyTrend": string — 1-2 sentences on whether spending improved or worsened across the year and what specific categories drove the change.
- "merchantInsights": array of 5 objects — { "merchant": string, "totalSpent": number (cents), "visits": number, "insight": string (2 sentences: 1 funny observation + 1 genuinely useful tip specific to this merchant) }. Pick the most interesting merchants.
- "savingsOpportunities": array of 5 objects — { "category": string, "currentAnnualSpend": number (cents), "alternative": string (name a specific real app, store, habit or service relevant to ${annualCurrency} users), "potentialAnnualSaving": number (realistic cents estimate), "tip": string (1-2 actionable sentences with real numbers) }
- "improvements": array of 5 strings — prioritized, specific financial improvements with concrete steps and realistic ${annualCurrency} savings amounts.
- "funFact": string — one surprising or funny statistical observation (e.g. "You visited Tim Hortons more often than you did laundry — 34 times in 12 months").

All monetary values in the JSON must be integers in cents. Be specific — use actual merchant names, real dates, and exact amounts from the data.`,
          },
          { role: "user", content: summaryText },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2500,
      });

      const aiData = JSON.parse(aiResponse.choices[0]?.message?.content || "{}");

      res.json({
        totalSpend,
        currency: annualCurrency,
        transactionCount: allExpenses.length,
        top5Categories: top5Categories.map(([cat, amt]) => ({ category: cat, amount: amt })),
        worstMonth: { month: worstMonth?.[0] || "", amount: worstMonth?.[1] || 0 },
        bestMonth: { month: bestMonth?.[0] || "", amount: bestMonth?.[1] || 0 },
        avgMonthlySpend: Math.round(avgMonthly),
        projection5yr: Math.round(projection5yr),
        monthlyTotals: sortedMonths.map(([month, amount]) => ({ month, amount })),
        roast: aiData.roast || "Your spending is a masterpiece of questionable decisions.",
        spendingPersonality: aiData.spendingPersonality || { title: "The Mystery Spender", description: "Your spending defies categorization." },
        behavioralAnalysis: aiData.behavioralAnalysis || "The data reveals a complex relationship with money.",
        monthlyTrend: aiData.monthlyTrend || "Your spending trend remained consistent throughout the year.",
        merchantInsights: aiData.merchantInsights || [],
        savingsOpportunities: aiData.savingsOpportunities || [],
        improvements: aiData.improvements || ["Save more", "Spend less", "Touch grass"],
        funFact: aiData.funFact || "",
      });
    } catch (err) {
      console.error("Annual report error:", err);
      res.status(500).json({ message: "Failed to generate annual report" });
    }
  });

  // ─── Contact Form ─────────────────────────────────────────────────
  app.post("/api/contact", async (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      message: z.string().min(10).max(2000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid submission", errors: parsed.error.flatten() });
    }
    const { name, email, message } = parsed.data;

    await storage.createContactSubmission({ name, email, message });

    try {
      const { getUncachableResendClient } = await import("./resend/resendClient");
      const resend = await getUncachableResendClient();
      await resend.emails.send({
        from: "Expense Roaster <admin@expenseroaster.com>",
        to: ["admin@expenseroaster.com"],
        replyTo: email,
        subject: `Contact from ${name}`,
        html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><hr><p>${message.replace(/\n/g, "<br>")}</p>`,
      });
    } catch (err) {
      console.error("Email send error:", err);
    }

    res.status(201).json({ ok: true });
  });

  // ─── Exchange Rate Proxy ─────────────────────────────────────────────────────
  app.get("/api/exchange-rate", async (req: Request, res: Response) => {
    const from = String(req.query.from || "USD").toUpperCase();
    const to = String(req.query.to || "USD").toUpperCase();
    if (from === to) return res.json({ rate: 1 });
    try {
      const resp = await fetch(`https://open.er-api.com/v6/latest/${from}`);
      const data = await resp.json() as { rates?: Record<string, number> };
      const rate = data.rates?.[to];
      if (!rate) return res.status(404).json({ error: "Rate not found" });
      return res.json({ rate });
    } catch {
      return res.status(502).json({ error: "Failed to fetch exchange rate" });
    }
  });

  // ─── Expenses: Bulk Delete (must be before /:id to avoid route shadowing) ───
  app.delete("/api/expenses/bulk", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids array required" });
    }
    const numericIds = ids.map(Number).filter(n => !isNaN(n));
    if (numericIds.length === 0) {
      return res.status(400).json({ message: "No valid IDs provided" });
    }
    const deleted = await storage.bulkDeleteExpenses(userId, numericIds);
    return res.json({ deleted });
  });

  // ─── Expenses: Update ────────────────────────────────────────────
  async function handleExpenseUpdate(req: any, res: Response) {
    const userId = getUserId(req);
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid expense ID" });
    const { description, amount, category, date, currency } = req.body;
    const data: { description?: string; amount?: number; category?: string; date?: Date; currency?: string } = {};
    if (description !== undefined) data.description = String(description).trim();
    if (amount !== undefined) data.amount = Number(amount);
    if (category !== undefined) data.category = String(category);
    if (date !== undefined) data.date = new Date(date);
    if (currency !== undefined) data.currency = String(currency);
    const updated = await storage.updateExpense(id, userId, data);
    if (!updated) return res.status(404).json({ message: "Expense not found" });
    return res.json(updated);
  }

  // ─── Expenses: Save Edit (mobile-safe, all params in query string) ────────
  // POST is converted to GET by Replit's dev proxy for external (mobile) clients.
  // Using GET + query params ensures reliable delivery from mobile devices.
  // Web clients still use PATCH /api/expenses/:id normally.
  app.get("/api/expenses/save-edit", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const { id, description, amount, category, date, currency } = req.query as Record<string, string>;
    const numId = Number(id);
    if (!id || isNaN(numId)) return res.status(400).json({ message: "Invalid expense ID" });
    const data: { description?: string; amount?: number; category?: string; date?: Date; currency?: string } = {};
    if (description !== undefined) data.description = String(description).trim();
    if (amount !== undefined) data.amount = Number(amount);
    if (category !== undefined) data.category = String(category);
    if (date !== undefined) data.date = new Date(date);
    if (currency !== undefined) data.currency = String(currency);
    const updated = await storage.updateExpense(numId, userId, data);
    if (!updated) return res.status(404).json({ message: "Expense not found" });
    return res.json(updated);
  });

  app.patch("/api/expenses/:id", isAuthenticated, handleExpenseUpdate);
  app.post("/api/expenses/:id", isAuthenticated, handleExpenseUpdate);
  app.post("/api/expenses/:id/update", isAuthenticated, handleExpenseUpdate);
  app.get("/api/expenses/:id/update", (_req, res) => {
    res.status(405).json({ message: "Method Not Allowed — use POST" });
  });

  // ─── Expenses: Delete ────────────────────────────────────────────
  app.delete(buildUrl(api.expenses.delete.path).replace(":id", ":id"), isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    await storage.deleteExpense(Number(req.params.id), userId);
    res.status(204).send();
  });

  return httpServer;
}
