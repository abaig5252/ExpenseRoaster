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

// ── Currency → country context for localised AI advice ───────────────────────
function currencyCountryContext(currency: string): string {
  const map: Record<string, string> = {
    CAD: "Canada. Use Canadian brands, services, and prices (e.g. Tim Hortons, Freshii, Loblaws, Costco Canada, PC Financial, TD/RBC/BMO/Scotiabank/CIBC, Rogers/Bell/Telus, LCBO, Hudson's Bay, Canadian Tire, Freshco, No Frills, Food Basics, Cineplex, Fido, Koodo, Public Mobile, Goodfood, Flashfood app, GoodLife Fitness, YMCAs). Savings tips should reference Canadian tax accounts like TFSA, RRSP, FHSA where relevant.",
    USD: "United States. Use US brands and prices (e.g. McDonald's McCafe, Trader Joe's, Costco, Walmart, Target, Chase/BofA/Wells Fargo/Credit unions, T-Mobile/Mint Mobile, Planet Fitness, ALDI, Kroger, CVS, Verizon, YouTube Premium, Robinhood, Fidelity). Reference US tax accounts like 401(k), IRA, HSA where relevant.",
    GBP: "United Kingdom. Use UK brands and prices (e.g. Tesco, Sainsbury's, Aldi UK, Lidl, Greggs, Pret a Manger, Monzo, Starling, Barclays, Halifax, HSBC, EE/O2/Vodafone/giffgaff, PureGym, The Gym Group, Deliveroo, Ocado, M&S Food). Reference ISA accounts, NS&I Premium Bonds where relevant.",
    AUD: "Australia. Use Australian brands and prices (e.g. Woolworths, Coles, ALDI Australia, Kmart, Big W, IGA, ANZ/CBA/NAB/Westpac, Aldi, Officeworks, JB Hi-Fi, Boost Juice, Guzman y Gomez, Menulog, HelloFresh AU, Bupa/Medibank, Optus/Telstra/Vodafone AU, Fitness First, Anytime Fitness AU). Reference Australian superannuation, offset accounts where relevant.",
    NZD: "New Zealand. Use NZ brands and prices (e.g. Countdown/Woolworths NZ, Pak'nSave, New World, The Warehouse, ANZ NZ/BNZ/ASB/Westpac NZ, Spark/One NZ/2degrees, Les Mills NZ, Uber Eats NZ). Reference KiwiSaver where relevant.",
    EUR: "Europe (Eurozone). Use pan-European and country-specific brands where possible (e.g. Lidl, Aldi, Carrefour, Mercadona, Rewe, Edeka, N26, Revolut, BlaBlaCar, Booking.com, Decathlon, MediaMarkt). Mention relevant EU financial tools.",
    INR: "India. Use Indian brands and prices (e.g. BigBasket, Blinkit, Swiggy, Zomato, Jio/Airtel/Vi, PhonePe, Paytm, HDFC/ICICI/SBI/Axis Bank, Zepto, Reliance Smart, Amazon India, Flipkart, Nykaa, Meesho, NPS, PPF, ELSS mutual funds). Reference Indian tax saving instruments like PPF, ELSS, NPS under Section 80C.",
    SGD: "Singapore. Use Singapore brands and prices (e.g. NTUC FairPrice, Cold Storage, Giant, Hawker centres, GrabFood, foodpanda SG, DBS/OCBC/UOB, Singtel/StarHub/M1, Gojek SG, Circles.Life, ActiveSG gyms). Reference CPF, SRS accounts where relevant.",
    HKD: "Hong Kong. Use Hong Kong brands and prices (e.g. ParknShop, Wellcome, HKTVmall, Cathay Pacific, MTR, HSBC HK, Hang Seng, HKD MPF, McDonald's HK, Deliveroo HK, OpenRice picks).",
    MXN: "Mexico. Use Mexican brands and prices (e.g. Walmart Mexico, Soriana, Oxxo, FEMSA, Rappi Mexico, BBVA Mexico, Santander MX, Banorte, Chedraui, Sam's Club MX, DiDi Food).",
    BRL: "Brazil. Use Brazilian brands and prices (e.g. Mercado Livre, iFood, Pão de Açúcar, Carrefour Brazil, Nubank, Itaú, Bradesco, Santander BR, Localiza, Gympass, Drogasil).",
    ZAR: "South Africa. Use South African brands and prices (e.g. Checkers, Pick n Pay, Woolworths SA, Takealot, Standard Bank, FNB, Nedbank, Absa, Vodacom, MTN SA, Mr Price, Discovery Health).",
    AED: "United Arab Emirates. Use UAE brands and prices (e.g. Carrefour UAE, Spinneys, LuLu Hypermarket, Talabat, Noon, Emirates NBD, ADCB, FAB, Etisalat/e&, du, Fitness First UAE).",
    CHF: "Switzerland. Use Swiss brands and prices (e.g. Migros, Coop Switzerland, Denner, Lidl CH, UBS, Credit Suisse/UBS, PostFinance, Swiss Post, SBB GA/Halbtax, Digitec/Galaxus).",
    SEK: "Sweden. Use Swedish brands and prices (e.g. ICA, Coop Sweden, Lidl SE, Klarna, Swish, Handelsbanken, SEB, Swedbank, Northmill, Hemköp, MatHem, SATS gym, Blocket).",
    NOK: "Norway. Use Norwegian brands and prices (e.g. Rema 1000, Kiwi, Meny, Coop Norway, DNB, SpareBank, Vipps, Oda.com, Foodora Norway, SATS gym Norway).",
    DKK: "Denmark. Use Danish brands and prices (e.g. Netto, Lidl Denmark, Føtex, Bilka, Nemlig.com, MobilePay, Danske Bank, Nordea DK, Salling Group).",
    JPY: "Japan. Use Japanese brands and prices (e.g. 7-Eleven Japan, FamilyMart, Lawson, Rakuten, Amazon Japan, PayPay, LINE Pay, SoftBank, docomo, AEON, Ito-Yokado, Suica/IC cards).",
    KRW: "South Korea. Use Korean brands and prices (e.g. Coupang, Baemin, Kakao Pay, Naver Pay, Samsung Card, Hyundai Card, KB Kookmin, Shinhan, GS25, CU convenience stores, Emart).",
  };
  const countryCtx = map[currency.toUpperCase()];
  if (countryCtx) return `The user is based in ${countryCtx}`;
  return `The user's currency is ${currency}. Tailor all recommendations, brand names, and pricing to a country that commonly uses ${currency}.`;
}

// ── Universal merchant name cleaner ─────────────────────────────────────────
// Server-lifetime in-memory cache: each unique raw name is cleaned exactly once,
// then all subsequent lookups are instant. No raw bank string ever reaches a
// prompt or the UI without passing through here first.
const _merchantCache = new Map<string, string>();
const MERCHANT_CLEANER_PROMPT =
  `You are a merchant name parser. You will be given a raw bank statement merchant name and must return only the clean, human readable version.\n\nRules:\n- Remove all transaction codes, reference numbers, and location suffixes\n- Convert ALL CAPS to Title Case\n- Recognize common merchants and return their proper brand name (e.g. "SP0TIFY P3D89" → "Spotify")\n- For unknown merchants, return the cleanest readable version possible\n- If the merchant appears to be a service provider, keep the core name only\n- Return only the cleaned name — nothing else, no explanation`;

async function cleanMerchantName(raw: string): Promise<string> {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed === "Unknown Purchase" || trimmed === "Unknown") return trimmed;
  const key = trimmed.toLowerCase();
  if (_merchantCache.has(key)) return _merchantCache.get(key)!;
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: MERCHANT_CLEANER_PROMPT },
        { role: "user", content: trimmed },
      ],
      max_completion_tokens: 20,
    });
    const cleaned = r.choices[0]?.message?.content?.trim() || trimmed;
    _merchantCache.set(key, cleaned);
    return cleaned;
  } catch {
    return trimmed;
  }
}

// Clean a list of names in parallel (deduplicates automatically via cache)
async function cleanMerchantNames(names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names.map(n => (n || "").trim()).filter(Boolean))];
  const pairs = await Promise.all(unique.map(async n => [n, await cleanMerchantName(n)] as [string, string]));
  return new Map(pairs);
}

const FREE_UPLOAD_LIMIT = 3;

const ROAST_PROMPTS: Record<string, string> = {

  // ── TIER 1: Roasted 🔥 ──────────────────────────────────────────────────
  // Sergio is exasperated but not done with you. He roasts, then he helps.
  // The closing line MUST be a concrete actionable tip. No tip = wrong tier.
  sergio: `You are Sergio, a 58-year-old self-made Italian-Canadian uncle. You came to Canada with $400, built a deli chain from nothing, bought your first property by tracking every dollar, and raised three kids on a budget that would make most people cry. You are sharp, funny, and frustrated — but you still want this person to do better. You just saw this receipt.

STRICT FORMAT — exactly 3 lines. Output nothing else.
LINE 1: Exasperated reaction. Name the merchant and exact amount. One Italian expression (Madonna mia, gesù, dio mio, per favore). Hard limit: 30 words.
LINE 2: SERGIO PERSONAL STORY — HARD REQUIREMENT. This rule overrides all length restrictions. You must work one of these exact phrases naturally into this line as part of Sergio's voice. Do not paraphrase. Do not summarize. Use one of them directly:
  Option A: "I came to this country with $400..."
  Option B: "At my deli, I fed people for less than this..."
  Option C: "I drove out of my way to save $2 on fuel because I knew habits decide everything..."
  Option D: "I raised three kids on a budget that would make yours look generous..."
  Option E: "My father came here with nothing and taught me that every dollar has a name..."
If none appear verbatim in LINE 2, the output is incomplete. Rewrite LINE 2 until one appears.
LINE 3: ACTIONABLE TIP — must be specific to the type of purchase on this receipt (e.g. for fuel: find cheaper stations, use GasBuddy, fill at quarter tank, track monthly fuel spend). One sentence. Name a concrete action, a specific number or target, and the realistic outcome. Vague tips like "track it" or generic budgeting advice are not acceptable. Hard limit: 20 words.

ENFORCEMENT:
- LINE 2 must contain one of the five exact phrases above. Paraphrase = fail. Missing = fail. Rewrite until it passes.
- LINE 3 must be specific to the merchant type on the receipt, not generic financial advice.
- No sentence may use "and" to chain two ideas — split it or cut one idea.
- Count words per line before outputting. Rewrite any line over its limit.
- No em dashes. No ellipsis.`,

  // ── TIER 2: Destroyed 💀 ────────────────────────────────────────────────
  // Sergio is past helping. There is no tip. No redemption arc. No safety net.
  // The closing line reframes their identity around this purchase.
  sergio_savage: `SERGIO IS NOT A GENERIC FINANCIAL COMMENTATOR.
He is a specific person with a specific history. Every output must feel like it came from him personally and no one else.

You are Sergio. You came here with $400. You built everything yourself. You are done explaining. You have seen this receipt and you have nothing constructive to offer — only the truth about who this person is.

CLOSING LINE BENCHMARKS — your closing line must match this energy exactly:
"You did not buy fuel. You bought permission to stay careless."
"You are not a music lover. You are a direct debit with headphones."
"This is not transport. This is a personality trait with a receipt."
"Lighting cash to feel busy" and "an expensive habit with a receipt" are the correct energy. Build on this standard.
The closing line must reframe what this purchase says about the person, not what it did to their money.
If the closing line could apply to any purchase by any person it is wrong. Rewrite it until it could only apply to this specific purchase.

STRICT FORMAT — 3 sentences then one closing line. Output nothing else.
SENTENCE 1: Immediate gut reaction. Name the merchant and exact amount. No warmup. Hard limit: 30 words.
SENTENCE 2: SERGIO PERSONAL STORY — HARD REQUIREMENT. This rule overrides all length restrictions. You must work one of these exact phrases naturally into this sentence as part of Sergio's voice. Do not paraphrase. Do not summarize. Use one of them directly:
  Option A: "I came to this country with $400..."
  Option B: "At my deli, I fed people for less than this..."
  Option C: "I drove out of my way to save $2 on fuel because I knew habits decide everything..."
  Option D: "I raised three kids on a budget that would make yours look generous..."
  Option E: "My father came here with nothing and taught me that every dollar has a name..."
If none appear verbatim in SENTENCE 2, the output is incomplete. Rewrite SENTENCE 2 until one appears.
SENTENCE 3: Place Italian expression (Madonna mia, gesù, dio mio) here at peak exasperation — not at the start. What this purchase reveals about their entire financial character. Hard limit: 30 words.
CLOSING LINE: IDENTITY VERDICT. One sentence. Reframes who they are through this purchase. Not the money — the person. Match the benchmark examples above. Hard limit: 15 words. GENERIC = WRONG. ADVICE = WRONG. REWRITE UNTIL IT IS SPECIFIC TO THIS PURCHASE AND THIS PERSON ONLY.

ENFORCEMENT:
- SENTENCE 2 must contain one of the five exact phrases above verbatim. Paraphrase = fail. Rewrite until it passes.
- CLOSING LINE must reframe identity, not money. Must be specific to this purchase. Must match benchmark energy.
- No sentence may use "and" to chain two ideas — split it or cut one idea.
- No em dashes. No ellipsis. No soft landing. No redemption. No tip. No advice.`,

};

// ─── Bank Statement Individual Transaction Prompts ─────────────────────────
const BANK_TX_ROAST_PROMPTS: Record<string, string> = {

  // ── TIER 1: Roasted 🔥 ──────────────────────────────────────────────────
  // Sergio is exasperated but not done with you. He roasts, then he helps.
  // The closing line MUST be a concrete actionable tip. No tip = wrong tier.
  sergio: `You are Sergio, a 58-year-old self-made Italian-Canadian uncle. You came to Canada with $400, built a deli chain from nothing, bought your first property by tracking every dollar, and raised three kids on a budget that would make most people cry. You are sharp, funny, and frustrated — but you still want this person to do better. You just saw this transaction.

STRICT FORMAT — exactly 3 lines. Output nothing else.
LINE 1: Exasperated reaction. Name the merchant and exact amount. One Italian expression (Madonna mia, gesù, dio mio, per favore). Hard limit: 30 words.
LINE 2: SERGIO PERSONAL STORY — HARD REQUIREMENT. This rule overrides all length restrictions. You must work one of these exact phrases naturally into this line as part of Sergio's voice. Do not paraphrase. Do not summarize. Use one of them directly:
  Option A: "I came to this country with $400..."
  Option B: "At my deli, I fed people for less than this..."
  Option C: "I drove out of my way to save $2 on fuel because I knew habits decide everything..."
  Option D: "I raised three kids on a budget that would make yours look generous..."
  Option E: "My father came here with nothing and taught me that every dollar has a name..."
If none appear verbatim in LINE 2, the output is incomplete. Rewrite LINE 2 until one appears.
LINE 3: ACTIONABLE TIP — must be specific to the type of transaction (e.g. for fuel: find cheaper stations, use GasBuddy, fill at quarter tank, track monthly fuel spend). One sentence. Name a concrete action, a specific number or target, and the realistic outcome. Vague tips like "track it" or generic budgeting advice are not acceptable. Hard limit: 20 words.

ENFORCEMENT:
- LINE 2 must contain one of the five exact phrases above. Paraphrase = fail. Missing = fail. Rewrite until it passes.
- LINE 3 must be specific to the merchant type on the transaction, not generic financial advice.
- No sentence may use "and" to chain two ideas — split it or cut one idea.
- Count words per line before outputting. Rewrite any line over its limit.
- Funny and frustrated — never mean. No em dashes. No ellipsis.`,

  // ── TIER 2: Destroyed 💀 ────────────────────────────────────────────────
  // Sergio is past helping. There is no tip. No redemption arc. No safety net.
  // The closing line reframes their identity around this transaction.
  sergio_savage: `SERGIO IS NOT A GENERIC FINANCIAL COMMENTATOR.
He is a specific person with a specific history. Every output must feel like it came from him personally and no one else.

You are Sergio. You came here with $400. You built everything yourself. You are done explaining. You have seen this transaction and you have nothing constructive to offer — only the truth about who this person is.

CLOSING LINE BENCHMARKS — your closing line must match this energy exactly:
"You did not buy fuel. You bought permission to stay careless."
"You are not a music lover. You are a direct debit with headphones."
"This is not transport. This is a personality trait with a receipt."
"Lighting cash to feel busy" and "an expensive habit with a receipt" are the correct energy. Build on this standard.
The closing line must reframe what this purchase says about the person, not what it did to their money.
If the closing line could apply to any purchase by any person it is wrong. Rewrite it until it could only apply to this specific purchase.

STRICT FORMAT — 3 sentences then one closing line. Output nothing else.
SENTENCE 1: Immediate gut reaction. Name the merchant and exact amount. No warmup. Hard limit: 30 words.
SENTENCE 2: SERGIO PERSONAL STORY — HARD REQUIREMENT. This rule overrides all length restrictions. You must work one of these exact phrases naturally into this sentence as part of Sergio's voice. Do not paraphrase. Do not summarize. Use one of them directly:
  Option A: "I came to this country with $400..."
  Option B: "At my deli, I fed people for less than this..."
  Option C: "I drove out of my way to save $2 on fuel because I knew habits decide everything..."
  Option D: "I raised three kids on a budget that would make yours look generous..."
  Option E: "My father came here with nothing and taught me that every dollar has a name..."
If none appear verbatim in SENTENCE 2, the output is incomplete. Rewrite SENTENCE 2 until one appears.
SENTENCE 3: Place Italian expression (Madonna mia, gesù, dio mio) here at peak exasperation — not at the start. What this purchase reveals about their entire financial character. Hard limit: 30 words.
CLOSING LINE: IDENTITY VERDICT. One sentence. Reframes who they are through this purchase. Not the money — the person. Match the benchmark examples above. Hard limit: 15 words. GENERIC = WRONG. ADVICE = WRONG. REWRITE UNTIL IT IS SPECIFIC TO THIS PURCHASE AND THIS PERSON ONLY.

ENFORCEMENT:
- SENTENCE 2 must contain one of the five exact phrases above verbatim. Paraphrase = fail. Rewrite until it passes.
- CLOSING LINE must reframe identity, not money. Must be specific to this purchase. Must match benchmark energy.
- No sentence may use "and" to chain two ideas — split it or cut one idea.
- No em dashes. No ellipsis. No soft landing. No redemption. No tip. No advice.`,
};

// ─── Bank Statement Prompts (whole-statement summary) ─────────────────────
const BANK_ROAST_PROMPTS: Record<string, string> = {
};


async function generateStatementRoast(
  transactions: { description: string; amount: number; date: string; category?: string }[],
  _tone: string,
  currency = "USD",
  month?: string,
  forceRefresh = false
): Promise<string> {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  // Clean all merchant names before building the summary
  const cleanMap = await cleanMerchantNames(transactions.map(tx => tx.description));

  // Build a merchant-frequency summary for the AI
  const merchantMap: Record<string, { count: number; total: number }> = {};
  for (const tx of transactions) {
    const name = cleanMap.get(tx.description) || tx.description;
    if (!merchantMap[name]) merchantMap[name] = { count: 0, total: 0 };
    merchantMap[name].count++;
    merchantMap[name].total += tx.amount;
  }
  const merchantLines = Object.entries(merchantMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15)
    .map(([name, { count, total: t }]) => {
      const shortName = name.length > 35 ? name.slice(0, 35) : name;
      return count > 1
        ? `${shortName} — ${t.toFixed(2)} ${currency} (${count}x)`
        : `${shortName} — ${t.toFixed(2)} ${currency}`;
    })
    .join("\n");

  // Format month label for the prompt (e.g. "December 2025")
  let monthLabel = "";
  if (month) {
    const [yr, mo] = month.split("-").map(Number);
    monthLabel = new Date(yr, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  // Pre-build the top-2 observation anchors. Use whole-dollar amounts (no decimal)
  // to prevent the model from outputting only the fractional/cents portion.
  const top4 = Object.entries(merchantMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 2)
    .map(([name, { total: t }]) => `${name} — ${Math.round(t)} ${currency}`);

  const seed = forceRefresh ? `\n\n[Field observation sequence: ${Date.now()}]` : "";
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `You are David Attenborough narrating someone's monthly bank statement as if it were a nature documentary about a financially questionable creature in the wild. Your tone is calm, serious, and deeply fascinated — but the observations are absolutely devastating. Use ${currency}.

STRICT FORMAT — output nothing else, in this exact order:

BLOCK 1 — OBSERVATION (exactly 2 sentences):
Write two calm, naturalistic documentary sentences in the style of David Attenborough observing wildlife. The very first sentence MUST open with "In the [season] of [month year], we observe..." — then continue with a specific merchant observation.

You must weave in both of the following merchant-and-amount facts — one per sentence. Use each merchant name and dollar amount EXACTLY as written below. Do not change the numbers:

${top4.map(line => `• ${line}`).join("\n")}

The tone is calm, never shocked — always more devastating for its composure.

BLANK LINE

BLOCK 2 — CLOSING LINE (1 sentence):
One final standalone sentence. Deadpan. Certain. Complete. It does not explain itself. It does not offer hope. Hard limit: 20 words.

BLANK LINE

BLOCK 3 — SAVING TIPS (exactly 3 lines):
Three practical saving tips, each a single plain prose sentence on its own line. Each tip MUST use a real merchant name and exact amount from the full data list.

MERCHANT RESEARCH RULES — apply before writing any tip:
- Telecom providers (Rogers, Bell, Telus, AT&T, Verizon, Shaw, Videotron, Freedom, Fido, Koodo, etc.) sell phone, internet, TV, and home security as bundles or separately. You CANNOT determine which service a charge is for from the name alone. Do NOT advise switching, cancelling, or consolidating telecom lines unless you are 100% certain what each charge is for. If uncertain, skip that merchant.
- Professional membership fees and licensing dues (CPA, CFA, CMA, bar association, medical licensing, engineering associations, real estate board fees, etc.) are mandatory professional obligations — they are not discretionary services. Do NOT advise reducing or pausing them. Skip any merchant that appears to be a professional body, licensing authority, or regulatory membership.
- Insurance charges can cover many products (auto, home, travel, life, disability, health). Do NOT advise switching or reducing insurance without knowing the product type. If uncertain, skip.
- Employer-reimbursed expenses, business expenses, and tax-deductible items should not be flagged as wasteful. Skip any merchant that could plausibly be business-related.
- SKIP RULE: If you cannot determine with high confidence what specific product or service a transaction represents, do not write a tip for that merchant. Choose a different merchant you ARE certain about.
- Only write tips for clearly discretionary consumer spending where you are certain about the product: restaurants, coffee shops, subscription streaming services, gyms, retail shopping, food delivery, etc.

ENFORCEMENT:
- Exactly 2 observation sentences, exactly 1 closing line, exactly 3 tip sentences.
- No numbered points. No bullet points. No dashes before tips. No headers. No sections. No markdown.
- No exclamation marks. No ellipsis. No em dashes. Plain text only.
- Blank line between Block 1 and Block 2. Blank line between Block 2 and Block 3.${seed}`,
      },
      {
        role: "user",
        content: `${monthLabel ? `${monthLabel}: ` : ""}${total.toFixed(2)} ${currency} across ${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}.\n\nFull merchant data:\n${merchantLines}`,
      },
    ],
    max_completion_tokens: 420,
    temperature: 0.7,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) {
    console.error("[generateStatementRoast] AI returned empty content. finish_reason:", response.choices[0]?.finish_reason, "transactions:", transactions.length);
    return `The specimen has distributed ${total} ${currency} across ${transactions.length} transactions this month with a consistency that suggests not spending is simply not something it has considered.\n\nIt will do this again next month.`;
  }
  return enforceStatementLength(content.replace(/\*+/g, ""));
}

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
  const cleanMap = await cleanMerchantNames(expenses.map(e => e.description));
  const lines = expenses.map(e =>
    `${cleanMap.get(e.description) || e.description} — ${(e.amountCents / 100).toFixed(2)} ${currency} (${e.category})`
  ).join('\n');

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `You are David Attenborough narrating someone's monthly spending habits as if it were a nature documentary about a financially questionable creature in the wild. Your tone is calm, serious, and deeply fascinated — but the observations are absolutely devastating. Use ${currency}.

Rules:
- Open like a nature documentary — observing the creature in its natural habitat
- Treat every spending decision as a fascinating but deeply concerning animal behavior
- Stay in character — you are NEVER shocked, always calmly fascinated, which makes it funnier
- Reference specific amounts, merchants, and patterns by name as your "field observations"
- No exclamation marks — the humor comes from the deadpan serious tone
- No trailing off, no ellipsis, no consolation prizes
- Exactly 3 sentences total
- Sentences 1-2: the nature documentary observation — specific, calm, devastating
- Sentence 3: a short, final, standalone closing note — deadpan, certain, and complete. This is the punchline. It should sound like the documentary's last word on a doomed species. It stands alone. It does not explain itself.
- Do not use em dashes (—) anywhere in your response`,
      },
      {
        role: "user",
        content: `${monthLabel}: ${total} ${currency} across ${expenses.length} receipt${expenses.length !== 1 ? 's' : ''}.\n\n${lines}`,
      },
    ],
    max_completion_tokens: 260,
  });
  return response.choices[0]?.message?.content ?? "Your bank account has filed a restraining order.";
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Hard-enforces the statement roast format: max 4 observation sentences + 1 closing line.
// Splits on the blank-line separator the model is instructed to produce.
// If the model ignored the format, falls back to sentence-level truncation.
function enforceStatementLength(text: string): string {
  // Strip any stray markdown artifacts the model might add
  const clean = text.replace(/\*+/g, "").replace(/^[-•]\s*/gm, "").trim();

  const parts = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  if (parts.length >= 3) {
    // 3-block format: observations | closing | tips
    const observationBlock = parts[0];
    const closingBlock = parts[1];
    const tipsBlock = parts.slice(2).join("\n").trim();

    // Cap observations at 4 sentences
    const sentences = observationBlock.match(/[^.!?]+[.!?]+(\s|$)/g) || [observationBlock];
    const trimmedObs = sentences.slice(0, 4).join(" ").trim();

    // Keep up to 3 tip lines
    const tipLines = tipsBlock.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 3);

    return `${trimmedObs}\n\n${closingBlock}\n\n${tipLines.join("\n")}`;
  }

  if (parts.length === 2) {
    // Old 2-block format: observations | closing (no tips yet)
    const body = parts[0];
    const closing = parts[1];
    const sentences = body.match(/[^.!?]+[.!?]+(\s|$)/g) || [body];
    const trimmedBody = sentences.slice(0, 4).join(" ").trim();
    return `${trimmedBody}\n\n${closing}`;
  }

  // Fallback: single block — split by sentence
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) || [clean];
  if (sentences.length <= 5) return clean;
  const body = sentences.slice(0, 4).join(" ").trim();
  const closing = sentences[sentences.length - 1].trim();
  return `${body}\n\n${closing}`;
}

// Pre-computes exact savings figures so the model never has to invent them.
// Assumes the purchase recurs weekly (52/12 = 4.333 weeks/month).
// Categories where billing period is unknown, annual, or fixed — weekly math is always wrong
const LUMP_SUM_CATEGORIES = new Set([
  "Insurance", "Professional Fees", "Subscriptions",
  "Internet", "Phone",
]);

function buildMathAnchors(amountCents: number, currency: string, category?: string): string {
  const sym = currency === "USD" ? "$" : currency + " ";
  const amt = amountCents / 100;

  // For fixed/lump-sum/subscription categories, skip weekly math entirely
  if (category && LUMP_SUM_CATEGORIES.has(category)) {
    const perMonth = (amt / 12).toFixed(2);
    const perDay   = (amt / 365).toFixed(2);
    const save15   = (amt * 0.15).toFixed(2);
    const save25   = (amt * 0.25).toFixed(2);

    const isSubscription = category === "Subscriptions" || category === "Internet" || category === "Phone";
    const periodNote = isSubscription
      ? `PERIOD NOTE: This is a fixed subscription or recurring bill — NOT a discretionary weekly purchase. LINE 3 MUST NOT say "per week" or suggest weekly spending caps. The tip must focus on: whether it is used/needed, a cheaper alternative, or switching billing frequency. Use one of the figures above.`
      : `PERIOD NOTE: This appears to be a one-time, annual, or irregular charge — NOT a weekly purchase. LINE 3 MUST NOT say "per week" or "per month savings". Give renewal/negotiation/comparison advice using the figures above.`;

    return [
      `MATH ANCHORS — use ONE of these exact figures in LINE 3. Do not invent, round, or estimate any financial number:`,
      `  - This charge: ${sym}${amt.toFixed(2)} ${currency}`,
      `  - If annual, amortized per month: ${sym}${perMonth} ${currency}/month`,
      `  - If annual, amortized per day: ${sym}${perDay} ${currency}/day`,
      `  - 15% saving: ${sym}${save15} ${currency}`,
      `  - 25% saving: ${sym}${save25} ${currency}`,
      periodNote,
      `MATH RULE: LINE 3 must contain one number from the MATH ANCHORS above. Any figure not listed is wrong.`,
    ].join("\n");
  }

  // Standard weekly-recurring math anchors
  const weeksPerMonth = 52 / 12; // 4.333
  const monthlyIfWeekly = amt * weeksPerMonth;

  const caps = [
    Math.ceil(amt * 0.75 / 5) * 5,
    Math.ceil(amt * 0.60 / 5) * 5,
    Math.ceil(amt * 0.50 / 5) * 5,
  ].filter((cap, i, arr) => cap < amt && arr.indexOf(cap) === i);

  const lines = caps.map(cap => {
    const weekSaving = amt - cap;
    const monthSaving = weekSaving * weeksPerMonth;
    return `  - Cap at ${sym}${cap}/week → saves ${sym}${monthSaving.toFixed(2)}/month`;
  });

  const pct20 = (amt * 0.20 * weeksPerMonth).toFixed(2);
  const pct30 = (amt * 0.30 * weeksPerMonth).toFixed(2);

  return [
    `MATH ANCHORS — use these exact figures in LINE 3. Do not invent, round, or estimate any financial number:`,
    `  - This receipt: ${sym}${amt.toFixed(2)} ${currency}`,
    `  - Monthly total if weekly purchase: ${sym}${monthlyIfWeekly.toFixed(2)} ${currency}`,
    ...lines,
    `  - 20% cut per purchase saves: ${sym}${pct20} ${currency}/month`,
    `  - 30% cut per purchase saves: ${sym}${pct30} ${currency}/month`,
    `MATH RULE: LINE 3 must contain one number from the MATH ANCHORS above. Any figure not listed above is wrong.`,
  ].join("\n");
}

async function generateRoast(description: string, amountCents: number, category: string, tone = "sergio", _location?: string, currency = "USD", date?: Date | string): Promise<string> {
  description = await cleanMerchantName(description);
  const prompt = ROAST_PROMPTS[tone] || ROAST_PROMPTS.sergio;
  let timeNote = "";
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      timeNote = ` on ${d.toLocaleString('en-US', { weekday: 'long' })} the ${ordinalSuffix(d.getDate())}`;
    }
  }
  // Inject pre-computed math anchors for Tier 1 only (Tier 2 never gives tips)
  const mathAnchors = tone === "sergio" ? `\n\n${buildMathAnchors(amountCents, currency, category)}` : "";
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: `${prompt}\n\nCurrency: ${currency}. Use the local currency symbol. Make any comparisons specific to real things that cost similar amounts in the ${currency} region. NEVER mention city names, street addresses, or neighbourhoods. Do not use em dashes (—).` },
      { role: "user", content: `Merchant: ${description}${timeNote}. Amount: ${(amountCents / 100).toFixed(2)} ${currency}. Category: ${category}.${mathAnchors}` },
    ],
    max_completion_tokens: 160,
  });
  return response.choices[0]?.message?.content || "Your accountant has left the chat.";
}

async function generateBankTransactionRoast(description: string, amountCents: number, category: string, tone = "sergio", currency = "USD", date?: Date | string): Promise<string> {
  const prompt = BANK_TX_ROAST_PROMPTS[tone] || BANK_TX_ROAST_PROMPTS.sergio;
  let timeNote = "";
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      timeNote = ` on ${d.toLocaleString('en-US', { weekday: 'long' })} the ${ordinalSuffix(d.getDate())}`;
    }
  }
  // Inject pre-computed math anchors for Tier 1 only (Tier 2 never gives tips)
  const mathAnchors = tone === "sergio" ? `\n\n${buildMathAnchors(amountCents, currency, category)}` : "";
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: `${prompt}\n\nCurrency: ${currency}. Use the local currency symbol. Make any comparisons specific to real things that cost similar amounts in the ${currency} region. NEVER mention city names, street addresses, or neighbourhoods.` },
      { role: "user", content: `Merchant: ${description}${timeNote}. Amount: ${(amountCents / 100).toFixed(2)} ${currency}. Category: ${category}.${mathAnchors}` },
    ],
    max_completion_tokens: 160,
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

  // ─── Stripe: Checkout — GET alias for mobile proxy compatibility ──
  // Replit dev proxy rewrites POST→GET for external (mobile) devices.
  app.get("/api/stripe/checkout", isAuthenticated, async (req: any, res) => {
    let priceId = (req.query.priceId || req.query.price_id) as string | undefined;
    const mode = (req.query.mode as string) || "subscription";
    const plan = req.query.plan as string | undefined;

    // If no priceId provided but a plan name was given, resolve it from the DB
    if (!priceId && plan) {
      try {
        const rows = await db.execute(sql`
          SELECT pr.id as price_id
          FROM stripe.products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          WHERE p.active = true
          ORDER BY pr.unit_amount ASC
          LIMIT 1
        `);
        const row = rows.rows[0] as { price_id?: string } | undefined;
        priceId = row?.price_id;
      } catch {
        // fall through to error below
      }
    }

    if (!priceId) return res.status(400).json({ message: "priceId required" });
    try {
      const userId = getUserId(req);
      let user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const stripe = await getUncachableStripeClient();
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email || undefined, metadata: { userId } });
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
      console.error("Checkout error (GET):", err);
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

  // Internal helper: auto-updates an existing verdict when new data arrives.
  // Does NOT increment regenCount — this is a data-driven update, not a manual regen.
  async function triggerAutoVerdictUpdate(userId: string, month: string, source: string): Promise<void> {
    try {
      const existing = await storage.getMonthlyVerdict(userId, month, source);
      if (!existing) return;
      const user = await storage.getUser(userId);
      if (!user) return;
      let all = await storage.getExpenses(userId);
      let filtered = all.filter(e => {
        const d = e.date instanceof Date ? e.date : new Date(String(e.date));
        return d.toISOString().slice(0, 7) === month;
      });
      if (source !== "all") filtered = filtered.filter(e => e.source === source);
      if (filtered.length === 0) return;
      const total = filtered.reduce((sum, e) => sum + e.amount, 0);
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
      await storage.updateVerdictRoast(existing.id, roast);
    } catch (err) {
      console.error("Auto verdict update failed:", err);
    }
  }

  app.get("/api/expenses/monthly-roast", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { month, source } = req.query as { month?: string; source?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month param must be YYYY-MM" });
    }

    const srcKey = source || "all";

    // Return stored verdict if it exists — never auto-generate on GET
    const existing = await storage.getMonthlyVerdict(userId, month, srcKey);
    let all = await storage.getExpenses(userId);
    let filtered = all.filter(e => {
      const d = e.date instanceof Date ? e.date : new Date(String(e.date));
      return d.toISOString().slice(0, 7) === month;
    });
    if (source) filtered = filtered.filter(e => e.source === source);
    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    if (existing) {
      // manualRegenUsed: premium users have used their one manual regen if regenCount >= 1
      const manualRegenUsed = existing.regenCount >= 1;
      return res.json({ roast: existing.roast, total, count: filtered.length, regenCount: existing.regenCount, locked: true, manualRegenUsed });
    }
    res.json({ roast: null, total, count: filtered.length, regenCount: 0, locked: false, manualRegenUsed: false });
  });

  // ─── Monthly verdict: generate or regenerate ──────────────────────
  // Free users: one-time generation only (locked after that, no manual regen)
  // Premium users: first-time generation + 1 manual regeneration per month
  app.post("/api/expenses/monthly-roast/regenerate", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { month, source } = req.body as { month?: string; source?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month must be YYYY-MM" });
    }
    const srcKey = source || "all";
    const existing = await storage.getMonthlyVerdict(userId, month, srcKey);

    if (user.tier === "free") {
      // Free users: allow first-time generation only
      if (existing) {
        return res.status(403).json({ message: "Your verdict is locked. Upgrade to Premium to regenerate." });
      }
    } else {
      // Premium: allow first-time generation + 1 manual regen (regenCount < 1 means regen available)
      if (existing && existing.regenCount >= 1) {
        return res.status(429).json({ message: "Manual regeneration limit reached (1 per month)" });
      }
    }

    let all = await storage.getExpenses(userId);
    let filtered = all.filter(e => {
      const d = e.date instanceof Date ? e.date : new Date(String(e.date));
      return d.toISOString().slice(0, 7) === month;
    });
    if (source) filtered = filtered.filter(e => e.source === source);
    if (filtered.length === 0) return res.status(400).json({ message: "No expenses to roast" });
    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
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
    let resultRoast: string;
    let resultRegenCount: number;
    if (!existing) {
      await storage.saveMonthlyVerdict(userId, month, srcKey, roast);
      resultRoast = roast;
      resultRegenCount = 0;
    } else {
      // Premium manual regen — increments regenCount
      const updated = await storage.regenerateMonthlyVerdict(existing.id, roast);
      resultRoast = updated.roast;
      resultRegenCount = updated.regenCount;
    }
    const manualRegenUsed = resultRegenCount >= 1;
    res.json({ roast: resultRoast, regenCount: resultRegenCount, locked: true, manualRegenUsed });
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

      const descCleanMap = await cleanMerchantNames(allExpenses.map(e => e.description));

      const categoryTotals: Record<string, number> = {};
      const categoryMerchants: Record<string, string[]> = {};
      for (const exp of allExpenses) {
        const cleanedDesc = descCleanMap.get(exp.description) || exp.description;
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        if (!categoryMerchants[exp.category]) categoryMerchants[exp.category] = [];
        if (!categoryMerchants[exp.category].includes(cleanedDesc)) {
          categoryMerchants[exp.category].push(cleanedDesc);
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

      const adviceCountryCtx = currencyCountryContext(adviceCurrency);

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a brutally honest, deeply knowledgeable financial advisor analyzing REAL spending data. You know local prices, brands, and alternatives for every major region.

${adviceCountryCtx}
All amounts must be in ${adviceCurrency} with realistic local pricing.
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
      "insight": "2-3 SPECIFIC, ACTIONABLE sentences. State the exact problem (e.g. 'You're spending X/mo on coffee alone'). Give a concrete fix with a specific number or action. Name a real local alternative vendor or habit that exists in the user's country.",
      "alternatives": [
        "Real cheaper option available locally — ~X ${adviceCurrency}",
        "Another real local option — ~X ${adviceCurrency}",
        "DIY / free option — free"
      ],
      "potentialSaving": <realistic cents saved per month if they follow the advice>
    }
  ]
}

MERCHANT RESEARCH RULES — apply to every insight and alternative before writing:
- Telecom providers (Rogers, Bell, Telus, AT&T, Verizon, Shaw, Videotron, Freedom, Fido, Koodo, etc.) offer phone, internet, TV, and home security — often in bundles. You CANNOT determine which service a charge is for from the merchant name alone. Do NOT advise switching providers, cancelling lines, or consolidating plans unless you are 100% certain what specific service is being charged. If uncertain, acknowledge the uncertainty in the insight and skip actionable advice for that merchant.
- Professional membership fees and licensing dues (CPA, CFA, CMA, bar associations, medical licensing, real estate boards, engineering associations, etc.) are mandatory professional obligations — not discretionary spending. Do NOT advise reducing or eliminating them. Note in the insight that these are likely non-discretionary professional costs.
- Insurance charges (travel, auto, home, life, disability, health) vary widely in product type. Do NOT advise switching or reducing insurance without knowing the exact product. If uncertain, note the ambiguity and skip actionable advice.
- Business and employer-reimbursed expenses should not be flagged as wasteful. If a merchant could plausibly be a business expense, note the ambiguity.
- SKIP RULE: Only provide specific actionable advice for clearly discretionary consumer spending where you are certain about the product (restaurants, coffee shops, streaming services, gyms, retail shopping, food delivery, etc.).

STRICT RULES FOR BREAKDOWN:
- Every category in the input MUST appear in breakdown. No exceptions.
- roast: reference specific merchant names from the data, be funny and sharp.
- insight: be concrete where certain. For ambiguous merchants, state the uncertainty clearly (e.g. "Rogers could be internet, phone, or a bundle — without knowing the service type, it's hard to advise a switch"). Never give wrong-footed advice by guessing.
- alternatives: MUST use REAL brand names and services that actually exist and are available in the user's country. Wrong: generic US suggestions for a Canadian user. Right: Tim Hortons, No Frills, Fido, GoodLife for CAD users.
- potentialSaving: be realistic. For a $400 dining habit, don't say $380 savings. Say $80-$150.
- LOCATION RULE: Do NOT mention city names, street addresses, or neighbourhoods unless they appear in the merchant name itself.`,
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

      const tone = req.body.tone || "sergio";
      const isFree = user.tier === "free";

      if (isFree && user.monthlyUploadCount >= FREE_UPLOAD_LIMIT) {
        return res.status(403).json({
          message: `Free tier limit reached. You get ${FREE_UPLOAD_LIMIT} free uploads per month.`,
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

      // Step 1: extract structured data only — roast is generated separately via
      // generateRoast() so the persona prompt is never overridden by a JSON field description
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: `You are a receipt data extractor. Extract structured data from this receipt image and return ONLY valid JSON. Keep the receipt's native currency — do NOT convert.` },
          {
            role: "user",
            content: [
              { type: "text", text: `First, decide if this image is a single-transaction receipt (e.g. from a store, restaurant, gas station, or online order) or a bank/credit-card statement (a multi-transaction document listing many purchases across time, with an account number, opening/closing balance, or statement period header).

Set "documentType" to "bank_statement" ONLY if the image clearly shows a bank or credit card statement with multiple transaction rows and an account summary — otherwise set it to "receipt". When in doubt, set it to "receipt".

If it IS a receipt, extract the expense details below.

FINDING THE TOTAL AMOUNT (most important):
1. Locate the final "Total", "Grand Total", "Amount Due", "Amount Paid", or "Balance Due" line — NOT "Subtotal".
2. Read the printed number on that line. This printed total is the ground truth. Report exactly what it says.
3. As a sanity check only: if you can clearly read all line items and taxes, sum them. If your sum is MORE THAN 10% different from the printed total, you may have picked the wrong line (e.g., subtotal instead of total) — re-examine and pick the correct FINAL total.
4. Do NOT substitute your own arithmetic for the printed total. The printed total is always preferred.

Convert the total to cents in the receipt's own currency (multiply × 100, round to nearest integer).

Respond ONLY with this JSON (no markdown, no extra keys):
{
  "documentType": "<'receipt' or 'bank_statement'>",
  "amount": <grand total in cents, integer>,
  "currency": "<3-letter ISO currency code from the receipt, e.g. USD, EUR, GBP, AUD>",
  "description": "<clean merchant name — proper brand name, Title Case, no codes or suffixes, e.g. 'Walmart', 'Starbucks', 'Spotify'>",
  "date": "<ISO date from receipt, e.g. 2024-03-15>",
  "category": "<Pick the single best match — Food & Drink (restaurants, cafes, bars, takeout, food delivery), Groceries (supermarkets, Walmart, Costco, grocery stores), Shopping (clothing, retail, electronics, department stores, Amazon, general merchandise — including phone hardware), Transport (gas stations, parking, Uber, Lyft, taxi, bus, subway, train, tolls, car wash), Travel (flights, hotels, Airbnb, car rental, accommodation), Entertainment (movies, concerts, events, gaming, theme parks, sports, nightlife), Health & Fitness (pharmacy, gym, doctor, dentist, spa, beauty, personal care), Subscriptions (recurring monthly/annual services, streaming, software, apps, memberships — use for telecom providers when the specific service is unclear), Donations (churches, mosques, temples, synagogues, charities, foundations, nonprofits, religious organizations, ministries, cathedrals, parishes — keywords: church, charity, donate, foundation, ministry, cathedral, parish, zakat, tithe, nonprofit, relief fund), Insurance (any insurance provider or premium — auto, home, life, health, disability, travel, tenant, commercial), Professional Fees (professional membership dues, licensing fees, association dues — CPA, CFA, CMA, bar association, medical licensing, engineering, real estate boards), Internet (home internet / broadband / fiber / cable internet service — only when clearly internet-specific), Phone (mobile phone plan / cellular service — only when clearly phone/wireless-specific, NOT phone hardware), Other (only if nothing above fits)>",
  "location": "<city and country from receipt, or null>"
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

      // Reject bank statements — free tier only or anyone trying to bypass the bank tab
      if (extracted.documentType === "bank_statement") {
        return res.status(422).json({
          message: "That looks like a bank statement, not a receipt. Use the Bank Statement tab to import multiple transactions.",
          code: "BANK_STATEMENT_DETECTED",
        });
      }

      const parsedDate = new Date(extracted.date);
      const dateToUse = isNaN(parsedDate.getTime()) || parsedDate.getFullYear() < 1990 ? new Date() : parsedDate;

      // Increment upload count regardless of tier
      await storage.incrementMonthlyUpload(userId);

      const detectedCurrency = (extracted.currency || "USD").toUpperCase();
      const cleanedDescription = await cleanMerchantName(extracted.description || "Unknown Purchase");
      const uploadCategory = extracted.category || "Other";
      const uploadAmountCents = Math.round(extracted.amount);

      // Step 2: generate the roast using the proper persona prompt (no JSON constraints)
      const uploadRoast = await generateRoast(cleanedDescription, uploadAmountCents, uploadCategory, tone, extracted.location || undefined, detectedCurrency, dateToUse);

      // For free users: return roast data but don't store
      if (isFree) {
        return res.status(201).json({
          id: -1,
          userId,
          amount: uploadAmountCents,
          currency: detectedCurrency,
          description: cleanedDescription,
          date: dateToUse.toISOString(),
          category: uploadCategory,
          roast: uploadRoast,
          imageUrl: null,
          source: "receipt",
          ephemeral: true,
          uploadsUsed: user.monthlyUploadCount + 1,
          uploadsLimit: FREE_UPLOAD_LIMIT,
        });
      }

      const expense = await storage.createExpense({
        userId,
        amount: uploadAmountCents,
        description: cleanedDescription,
        date: dateToUse,
        category: uploadCategory,
        roast: uploadRoast,
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
      const tone = req.body.tone || "sergio";
      const input = api.expenses.upload.input.parse(req.body);
      let imageUrl = input.image;
      if (/^data:image\/(heic|heif)/i.test(imageUrl)) {
        const base64Data = imageUrl.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const jpegBuffer = await sharp(buffer).rotate().jpeg({ quality: 90 }).toBuffer();
        imageUrl = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
      }
      // Step 1: extract structured data only (no roast — roast is generated separately so
      // the persona prompt is never overridden by a JSON field description)
      const extractionPrompt = `You are a receipt data extractor. Extract structured data from this receipt image and return ONLY valid JSON. Keep the receipt's native currency — do NOT convert.`;
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: extractionPrompt },
          { role: "user", content: [
            { type: "text", text: `First, decide if this is a single-transaction receipt or a bank/credit-card statement (multiple transaction rows, account number, statement period). Set "documentType" to "bank_statement" ONLY if it clearly shows a bank or credit card statement — otherwise "receipt". When in doubt, set "receipt".\n\nIf it IS a receipt, find the final "Total", "Grand Total", "Amount Due", or "Amount Paid" line — NOT Subtotal. Keep the receipt's own currency.\n\nRespond ONLY with this JSON:\n{\n  "documentType": "<'receipt' or 'bank_statement'>",\n  "amount": <cents integer>,\n  "currency": "<3-letter ISO code from receipt, e.g. USD, EUR, GBP, AUD>",\n  "description": "<clean merchant name — proper brand name, Title Case, no codes or suffixes, e.g. 'Walmart', 'Starbucks', 'Spotify'>",\n  "date": "<ISO date e.g. 2024-03-15>",\n  "category": "<Pick the single best match — Food & Drink (restaurants, cafes, bars, takeout, food delivery), Groceries (supermarkets, Walmart, Costco, grocery stores), Shopping (clothing, retail, electronics, department stores, Amazon, general merchandise — including phone hardware), Transport (gas stations, parking, Uber, Lyft, taxi, bus, subway, train, tolls, car wash), Travel (flights, hotels, Airbnb, car rental, accommodation), Entertainment (movies, concerts, events, gaming, theme parks, sports, nightlife), Health & Fitness (pharmacy, gym, doctor, dentist, spa, beauty, personal care), Subscriptions (recurring monthly/annual services, streaming, software, apps, memberships — use for telecom when specific service is unclear), Donations (churches, mosques, temples, charities, nonprofits — keywords: church, charity, donate, foundation, ministry, zakat, tithe), Insurance (any insurance provider or premium — auto, home, life, health, disability, travel, tenant), Professional Fees (professional membership dues, licensing fees, association dues — CPA, CFA, bar association, medical licensing), Internet (home internet/broadband/fiber — only when clearly internet-specific), Phone (mobile phone plan/cellular service — only when clearly wireless-specific, NOT phone hardware), Other (only if nothing above fits)>"\n}` },
            { type: "image_url", image_url: { url: imageUrl } },
          ]},
        ],
        response_format: { type: "json_object" },
      });
      const resultText = aiResponse.choices[0]?.message?.content;
      if (!resultText) throw new Error("No AI response");
      const extracted = JSON.parse(resultText);
      if (extracted.documentType === "bank_statement") {
        return res.status(422).json({
          message: "That looks like a bank statement, not a receipt. Use the Bank Statement tab to import multiple transactions.",
          code: "BANK_STATEMENT_DETECTED",
        });
      }
      const parsedDate = new Date(extracted.date);
      const dateToUse = isNaN(parsedDate.getTime()) || parsedDate.getFullYear() < 1990 ? new Date() : parsedDate;
      const previewCurrency = (extracted.currency || "USD").toUpperCase();
      const previewDescription = await cleanMerchantName(extracted.description || "Unknown Purchase");
      const previewAmountCents = Math.round(extracted.amount);
      const previewCategory = extracted.category || "Other";
      // Step 2: generate roast using the full persona prompt (no JSON format constraints)
      const roast = await generateRoast(previewDescription, previewAmountCents, previewCategory, tone, undefined, previewCurrency, dateToUse);
      res.json({
        amount: previewAmountCents,
        currency: previewCurrency,
        description: previewDescription,
        date: dateToUse.toISOString(),
        category: previewCategory,
        roast,
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
      const { amount, description: rawDescription, date, category, roast, currency: bodyCurrency } = req.body;
      if (!amount || !rawDescription || !date || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const description = await cleanMerchantName(rawDescription);
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
      // Fire-and-forget: auto-update the verdict for this month if one exists
      const expenseMonth = new Date(date).toISOString().slice(0, 7);
      triggerAutoVerdictUpdate(userId, expenseMonth, "receipt");
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
      const tone = (req.body.tone as string) || "sergio";
      const manualCurrency = input.currency || "USD";
      const cleanedManualDesc = await cleanMerchantName(input.description);
      const roast = await generateRoast(cleanedManualDesc, input.amount, input.category, tone, undefined, manualCurrency, new Date(input.date));

      const expense = await storage.createExpense({
        userId,
        amount: Math.round(input.amount),
        description: cleanedManualDesc,
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

  // ─── Donation keyword detector ───────────────────────────────────
  const DONATION_KEYWORDS = [
    "church", "mosque", "temple", "synagogue", "cathedral", "chapel", "parish",
    "ministry", "ministries", "diocese", "mission", "charity", "charitable",
    "foundation", "nonprofit", "non-profit", "ngo", "relief fund", "food bank",
    "salvation army", "red cross", "habitat for humanity", "goodwill",
    "donate", "donation", "tithe", "tithing", "zakat", "sadaqah",
    "religious", "gospel", "bible", "baptist", "methodist", "catholic",
    "christian", "islamic", "jewish", "hindu", "sikh", "buddhist",
    "st.", "saint", "holy", "blessed", "sacred",
  ];
  function isDonation(name: string): boolean {
    const lower = name.toLowerCase();
    return DONATION_KEYWORDS.some(kw => lower.includes(kw));
  }

  // ─── Shared: process a list of raw transactions into expenses ─────
  async function processTransactions(
    userId: string,
    transactions: { description: string; amount: number; date: string }[],
    tone: string,
    location?: string,
    currency = "USD"
  ) {
    const created: Expense[] = [];
    const userRules = await storage.getCategoryRules(userId);
    const rulesContext = userRules.length > 0
      ? `\n\nThis user's learned category corrections (apply these when the description matches):\n${userRules.map(r => `- "${r.merchantPattern}" → ${r.category}`).join("\n")}`
      : "";
    for (const tx of transactions.slice(0, 100)) {
      if (!tx.amount || tx.amount <= 0) continue;
      const parsedDate = new Date(tx.date);
      const date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const matchedRule = userRules.find(r =>
        tx.description.toLowerCase().includes(r.merchantPattern.toLowerCase()) ||
        r.merchantPattern.toLowerCase().includes(tx.description.toLowerCase())
      );
      let category: string;
      let cleanedDescription: string = tx.description;
      if (matchedRule) {
        category = matchedRule.category;
        // Use shared cache-aware cleaner
        cleanedDescription = await cleanMerchantName(tx.description);
      } else if (isDonation(tx.description)) {
        // Keyword-based donation detection — skip AI category call
        category = "Donations";
        cleanedDescription = await cleanMerchantName(tx.description);
      } else {
        // Check if name is already cached — if so, only need category call
        const cacheKey = tx.description.trim().toLowerCase();
        const cachedName = _merchantCache.get(cacheKey);
        if (cachedName) {
          cleanedDescription = cachedName;
          // Still need category — quick category-only call
          const catOnly = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [
              { role: "system", content: `Categorize this merchant into exactly one of: Food & Drink, Groceries, Shopping, Transport, Travel, Entertainment, Health & Fitness, Subscriptions, Donations, Insurance, Professional Fees, Internet, Phone, Other.\n\nDonations = churches, mosques, temples, synagogues, charities, foundations, nonprofits, religious organizations, ministries — keywords: church, charity, donate, foundation, ministry, cathedral, parish, zakat, tithe, nonprofit, relief fund.\nInsurance = any insurance provider or policy (auto, home, life, health, disability, travel, tenant, commercial).\nProfessional Fees = professional membership dues, licensing fees, regulatory fees, association dues (CPA, CFA, bar, medical, engineering, real estate boards).\nInternet = home internet / broadband / fiber / cable internet providers (e.g. Rogers internet, Bell Fibe, Shaw).\nPhone = mobile phone plans, cellular service charges (e.g. Rogers wireless, Fido, Koodo, Telus mobility).\nNOTE: Rogers, Bell, Telus etc. offer BOTH internet AND phone — only use Internet or Phone if the specific service is clearly indicated; otherwise use Subscriptions.${rulesContext}\n\nRespond with ONLY the category name.` },
              { role: "user", content: cleanedDescription },
            ],
            max_completion_tokens: 15,
          });
          category = catOnly.choices[0]?.message?.content?.trim() || "Other";
        } else {
          // Combined name+category call (populates cache afterward)
          const aiCat = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [
              { role: "system", content: `You are a merchant name parser AND transaction categorizer. Given a raw bank statement merchant name, return a JSON object with two fields:
1. "name": the clean, human-readable merchant name — remove transaction codes, reference numbers, location suffixes; convert ALL CAPS to Title Case; recognize common brands (e.g. "SP0TIFY P3D89" → "Spotify"); return only the core name, no explanation
2. "category": exactly one of these values — pick the best match:
   - Food & Drink (restaurants, cafes, bars, takeout, food delivery, fast food)
   - Groceries (supermarkets, Walmart, Costco, grocery stores, bulk food)
   - Shopping (clothing, retail, electronics, department stores, Amazon, general merchandise)
   - Transport (gas stations, parking, Uber, Lyft, taxi, bus, subway, train, tolls, car wash)
   - Travel (flights, hotels, Airbnb, car rental, accommodation, travel agencies)
   - Entertainment (movies, concerts, events, gaming, theme parks, sports, nightlife)
   - Health & Fitness (pharmacy, gym, doctor, dentist, spa, beauty salon, personal care)
   - Subscriptions (recurring monthly/annual services, streaming, software, apps, memberships — use this for telecom providers when specific service is unclear)
   - Donations (churches, mosques, temples, synagogues, charities, foundations, nonprofits, religious organizations, ministries, cathedrals, parishes — any name containing: church, charity, donate, foundation, ministry, cathedral, parish, zakat, tithe, nonprofit, relief fund)
   - Insurance (auto, home, life, health, disability, travel, tenant, or commercial insurance providers and policies)
   - Professional Fees (professional membership dues, licensing fees, regulatory fees, association dues — CPA, CFA, CMA, bar association, medical licensing, engineering associations, real estate boards)
   - Internet (home internet / broadband / fiber / cable internet service — only when clearly internet-specific)
   - Phone (mobile phone plans, cellular service — only when clearly phone/wireless-specific)
   - Other (only if nothing above clearly fits)${rulesContext}

Respond ONLY with JSON: {"name": "<cleaned name>", "category": "<category>"}` },
              { role: "user", content: tx.description },
            ],
            max_completion_tokens: 40,
            response_format: { type: "json_object" },
          });
          try {
            const parsed = JSON.parse(aiCat.choices[0]?.message?.content?.trim() || "{}");
            cleanedDescription = parsed.name || tx.description;
            category = parsed.category || "Other";
            // Populate the shared cache so subsequent roast/advice calls are instant
            if (cleanedDescription && cleanedDescription !== tx.description) {
              _merchantCache.set(cacheKey, cleanedDescription);
            }
          } catch {
            category = "Other";
          }
        }
      }
      const roast = await generateBankTransactionRoast(cleanedDescription, Math.round(tx.amount * 100), category, tone, currency, date);
      const expense = await storage.createExpense({
        userId,
        amount: Math.round(tx.amount * 100),
        description: cleanedDescription,
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
    const toneVal = tone || "sergio";
    const userCurrency = bodyCurrency || user.currency || "USD";

    // ── Pre-parsed path: transactions already extracted, just save+roast ──
    if (Array.isArray(preParsed) && preParsed.length > 0) {
      try {
        let txs = preParsed as { description: string; amount: number; date: string }[];
        const statementMonth = month || (txs[0]?.date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7));
        if (month) {
          const [yr, mo] = month.split('-').map(Number);
          const daysInMonth = new Date(yr, mo, 0).getDate();
          txs = txs.map(tx => {
            const day = Math.min(Number((tx.date || "01").slice(8, 10)) || 1, daysInMonth);
            return { ...tx, date: `${yr}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
          });
        }
        const created = await processTransactions(userId, txs, toneVal, undefined, userCurrency);
        const existingRoast1 = await storage.getStatementRoast(userId, statementMonth);
        if (existingRoast1) await storage.markStatementRoastDirty(userId, statementMonth);
        // Fire-and-forget: auto-update monthly verdict if one exists for this month
        triggerAutoVerdictUpdate(userId, statementMonth, "bank_statement");
        triggerAutoVerdictUpdate(userId, statementMonth, "all");
        return res.status(201).json({ imported: created.length, expenses: created, month: statementMonth });
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
        const pdfMonth = month || (txs[0]?.date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7));
        const existingRoast2 = await storage.getStatementRoast(userId, pdfMonth);
        if (existingRoast2) await storage.markStatementRoastDirty(userId, pdfMonth);
        return res.status(201).json({ imported: created.length, expenses: created, month: pdfMonth });
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
        const imgMonth = month || (txs[0]?.date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7));
        const existingRoast3 = await storage.getStatementRoast(userId, imgMonth);
        if (existingRoast3) await storage.markStatementRoastDirty(userId, imgMonth);
        return res.status(201).json({ imported: created.length, expenses: created, month: imgMonth });
      }

      return res.status(400).json({ message: "Unsupported format. Use pdf or image." });
    } catch (err) {
      console.error("Statement import error:", err);
      res.status(500).json({ message: "Failed to import statement" });
    }
  });

  // ─── Statement months available for the user ─────────────────
  app.get("/api/statement-months", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const months = await storage.getStatementMonths(userId);
    res.json({ months });
  });

  // ─── Fetch persisted statement roast for a month ─────────────
  app.get("/api/statement-roast/:month", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const { month } = req.params;
    const row = await storage.getStatementRoast(userId, month);

    const FALLBACK = "The record has been updated.";
    const needsGeneration = !row || !row.roast || row.roast === FALLBACK;

    if (!needsGeneration) {
      return res.json({ roast: row.roast.replace(/\*+/g, ""), tone: row.tone, isDirty: row.isDirty ?? false });
    }

    // No roast yet — return null so the client can show a Generate button
    return res.json({ roast: null, tone: null, isDirty: false });
  });

  // ─── Statement roast: force-regenerate (clears cache, re-runs prompt) ─
  app.post("/api/statement-roast/:month/regenerate", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const { month } = req.params;
    const user = await storage.getUser(userId);
    const currency = user?.currency ?? "USD";

    const allExpenses = await storage.getExpenses(userId);
    const monthTxs = allExpenses.filter(e => {
      const d = e.date instanceof Date ? e.date : new Date(String(e.date));
      return d.toISOString().slice(0, 7) === month && e.source !== "receipt";
    });

    if (monthTxs.length === 0) {
      return res.status(400).json({ message: "No transactions found for this month." });
    }

    const txsForRoast = monthTxs.map(e => ({
      description: e.description,
      amount: e.amount / 100,
      date: (e.date instanceof Date ? e.date : new Date(String(e.date))).toISOString(),
      category: e.category,
    }));

    try {
      const roast = await generateStatementRoast(txsForRoast, "sergio", currency, month, true);
      // Delete the old roast entirely, then insert a fresh row
      await storage.deleteStatementRoast(userId, month);
      await storage.saveStatementRoast(userId, month, roast, "sergio");
      console.log(`[statement-roast/regenerate] replaced roast for ${userId}/${month}, length=${roast.length}`);
      res.setHeader("Cache-Control", "no-store");
      return res.json({ roast, tone: "sergio" });
    } catch (err) {
      console.error("[statement-roast/regenerate] failed:", err);
      return res.status(500).json({ message: "Failed to regenerate roast." });
    }
  });

  // ─── Expenses: Annual report (premium or hasAnnualReport) ────────
  app.post("/api/expenses/annual-report", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user || !user.hasAnnualReport) {
      return res.status(403).json({ message: "Annual Report requires purchase", code: "ANNUAL_REQUIRED" });
    }

    try {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
      const reportYear = now.getFullYear();
      const ytdLabel = `Jan 1, ${reportYear} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

      const rawExpenses = await storage.getExpenses(userId);

      // YTD: current year only — used for all analysis, roast, categories, merchants
      const allExpenses = rawExpenses.filter(e => {
        const d = new Date(e.date);
        return d >= yearStart && d <= now;
      });

      if (allExpenses.length < 3) {
        return res.status(400).json({ message: `Need at least 3 transactions from ${reportYear} to generate a year-to-date report. Upload some receipts or bank statements from this year first.` });
      }

      // All-time: every uploaded transaction — used only for the 5-year projection
      const allTimeMonthlyTotals: Record<string, number> = {};
      for (const exp of rawExpenses) {
        const month = new Date(exp.date).toISOString().slice(0, 7);
        allTimeMonthlyTotals[month] = (allTimeMonthlyTotals[month] || 0) + exp.amount;
      }
      const allTimeMonths = Object.keys(allTimeMonthlyTotals).length;
      const allTimeTotalSpend = rawExpenses.reduce((s, e) => s + e.amount, 0);
      const avgMonthlyAllTime = allTimeTotalSpend / Math.max(allTimeMonths, 1);
      const projection5yr = Math.round(avgMonthlyAllTime * 12 * 5);
      const allTimeYearsRange = allTimeMonths > 0
        ? (() => {
            const months = Object.keys(allTimeMonthlyTotals).sort();
            const start = months[0]?.slice(0, 4);
            const end = months[months.length - 1]?.slice(0, 4);
            return start === end ? start : `${start}–${end}`;
          })()
        : String(reportYear);

      const annualCleanMap = await cleanMerchantNames(allExpenses.map(e => e.description || "Unknown"));

      const categoryTotals: Record<string, number> = {};
      const monthlyTotals: Record<string, number> = {};
      const merchantSpend: Record<string, { total: number; count: number }> = {};

      for (const exp of allExpenses) {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        const month = new Date(exp.date).toISOString().slice(0, 7);
        monthlyTotals[month] = (monthlyTotals[month] || 0) + exp.amount;
        const merchant = annualCleanMap.get(exp.description || "Unknown") || exp.description || "Unknown";
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
      const projectionFullYear = Math.round(avgMonthly * 12);
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

      // All merchant aggregates — compact, analytically rich, much smaller than raw rows
      const allMerchants = Object.entries(merchantSpend)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, d]) => `${name}|${(d.total / 100).toFixed(2)} ${annualCurrency}|${d.count} visits`)
        .join("\n");

      // Monthly breakdown
      const monthlyBreakdown = sortedMonths
        .map(([m, a]) => `${m}: ${(a / 100).toFixed(2)} ${annualCurrency}`)
        .join(", ");

      // Top 25 biggest individual transactions for context
      const biggestTx = [...allExpenses]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 25)
        .map(e => `${e.date} ${annualCleanMap.get(e.description || "Unknown") || e.description || "Unknown"} ${(e.amount / 100).toFixed(2)} ${annualCurrency} [${e.category}]`)
        .join("\n");

      const summaryText = `YEAR-TO-DATE SPENDING ANALYSIS (${ytdLabel}, ${allExpenses.length} transactions, currency: ${annualCurrency})
NOTE: All amounts in this data are in ${annualCurrency} dollars (main currency unit), NOT cents. When you write prose, use these dollar values directly (e.g. "$1,694.99 ${annualCurrency}"). For JSON numeric fields marked as cents, multiply the dollar value by 100.

ALL MERCHANTS (name|total_spent|visits):
${allMerchants}

MONTHLY TOTALS: ${monthlyBreakdown}
SPENDING TREND: ${trendDir} (comparing first half to second half of year-to-date period)
CATEGORIES: ${top5Categories.map(([c, a]) => `${c} ${(a / 100).toFixed(2)} ${annualCurrency}`).join(" | ")}
BEST MONTH: ${bestMonth?.[0]} (${((bestMonth?.[1] || 0) / 100).toFixed(2)} ${annualCurrency})
WORST MONTH: ${worstMonth?.[0]} (${((worstMonth?.[1] || 0) / 100).toFixed(2)} ${annualCurrency})
AVG MONTHLY: ${(avgMonthly / 100).toFixed(2)} ${annualCurrency}
YTD TOTAL: ${(totalSpend / 100).toFixed(2)} ${annualCurrency}
FULL YEAR PROJECTION (at current pace): ${(projectionFullYear / 100).toFixed(2)} ${annualCurrency}

TOP 25 BIGGEST TRANSACTIONS:
${biggestTx}`;

      const annualCountryCtx = currencyCountryContext(annualCurrency);

      const systemPrompt = `You are the world's most insightful (and entertainingly savage) financial analyst. The user paid for this premium ${reportYear} year-to-date report (${ytdLabel}) — make it thorough, specific, fun and genuinely useful. You have full merchant aggregates and biggest transactions.

${annualCountryCtx}
All monetary amounts are in ${annualCurrency}. Every alternative, tip, company, app, or service you mention MUST be real and actually available in the user's country. Do not suggest US companies to a Canadian user, UK brands to an Australian user, etc.

CRITICAL FORMATTING RULE — applies to ALL string fields (roast, descriptions, insights, tips, improvements, funFact):
- NEVER write raw cent values in text. ALWAYS convert to the main currency unit.
- Example: 169499 cents → $1,694.99 ${annualCurrency}. NEVER write "169499 cents" in any string.
- Format amounts as: $X,XXX.XX ${annualCurrency} (e.g. "$1,694.99 CAD", "$85.00 CAD")
- Numeric JSON fields (totalSpent, currentAnnualSpend, potentialAnnualSaving) MUST remain integers in cents — only string prose must use dollars.

Respond ONLY with valid JSON with exactly these keys:
- "roast": string — 5-6 sentences of savage but accurate roast referencing specific merchant names, formatted dollar amounts (not cents), and patterns from this year so far.
- "spendingPersonality": object — { "title": string (fun archetype max 5 words e.g. "The Subscription Hoarder"), "description": string (2 sentences based on actual data, using dollar amounts not cents) }
- "behavioralAnalysis": string — 4-5 sentences: what spending patterns reveal about this person's lifestyle, priorities, emotional triggers, habits. Use dollar amounts when mentioning figures.
- "monthlyTrend": string — 1-2 sentences on whether spending improved or worsened month-over-month and what drove it. Use dollar amounts.
- "merchantInsights": array of 5 objects — { "merchant": string, "totalSpent": number (cents integer), "visits": number, "insight": string (funny observation + useful country-specific tip — use dollar amounts in text, not cents) }
- "savingsOpportunities": array of 5 objects — { "category": string, "currentAnnualSpend": number (cents integer), "alternative": string (specific real app/store/service that exists in the user's country), "potentialAnnualSaving": number (cents integer), "tip": string (actionable 1-2 sentences with real dollar amounts and local brand names) }
- "improvements": array of 5 strings — prioritized improvements with concrete steps, local brand names, and realistic dollar savings amounts (not cents).
- "funFact": string — one surprising or funny statistical observation from the data, using dollar amounts not cents.
All numeric monetary JSON fields must be integers in cents. All text/string fields must express amounts in dollars (main currency unit).`;

      const makeAIRequest = (model: string, timeoutMs?: number) => openai.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: summaryText },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2000,
        },
        timeoutMs ? { timeout: timeoutMs } : undefined,
      );

      let aiResponse;
      try {
        aiResponse = await makeAIRequest("gpt-5.2", 30000);
      } catch (primaryErr: any) {
        console.log("Annual report: gpt-5.2 failed, falling back to gpt-4o:", primaryErr?.code || primaryErr?.message);
        aiResponse = await makeAIRequest("gpt-4o", 90000);
      }

      const aiData = JSON.parse(aiResponse.choices[0]?.message?.content || "{}");

      // Reset the flag so all users must pay $29.99 again for each new report
      await storage.updateUserAnnualReport(userId, false);

      const responsePayload = {
        totalSpend,
        currency: annualCurrency,
        transactionCount: allExpenses.length,
        reportYear,
        ytdLabel,
        top5Categories: top5Categories.map(([cat, amt]) => ({ category: cat, amount: amt })),
        worstMonth: { month: worstMonth?.[0] || "", amount: worstMonth?.[1] || 0 },
        bestMonth: { month: bestMonth?.[0] || "", amount: bestMonth?.[1] || 0 },
        avgMonthlySpend: Math.round(avgMonthly),
        projection5yr,
        allTimeYearsRange,
        allTimeTotalSpend,
        monthlyTotals: sortedMonths.map(([month, amount]) => ({ month, amount })),
        roast: aiData.roast || "Your spending is a masterpiece of questionable decisions.",
        spendingPersonality: aiData.spendingPersonality || { title: "The Mystery Spender", description: "Your spending defies categorization." },
        behavioralAnalysis: aiData.behavioralAnalysis || "The data reveals a complex relationship with money.",
        monthlyTrend: aiData.monthlyTrend || "Your spending trend remained consistent throughout the year.",
        merchantInsights: aiData.merchantInsights || [],
        savingsOpportunities: aiData.savingsOpportunities || [],
        improvements: aiData.improvements || ["Save more", "Spend less", "Touch grass"],
        funFact: aiData.funFact || "",
      };

      // Persist the report so it survives page refreshes
      await storage.saveAnnualReport(userId, reportYear, ytdLabel, responsePayload as unknown as Record<string, unknown>);

      res.json(responsePayload);
    } catch (err) {
      console.error("Annual report error:", err);
      res.status(500).json({ message: "Failed to generate annual report" });
    }
  });

  // GET latest saved annual report (persisted — no re-generation)
  app.get("/api/expenses/annual-report/latest", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const report = await storage.getLatestAnnualReport(userId);
      if (!report) return res.status(404).json({ message: "No report generated yet" });
      res.json(report);
    } catch (err) {
      console.error("Fetch annual report error:", err);
      res.status(500).json({ message: "Failed to fetch report" });
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
    // Capture affected months for bank_statement expenses before deleting
    const allExpenses = await storage.getExpenses(userId);
    const toDelete = allExpenses.filter(e => numericIds.includes(e.id) && e.source !== "receipt");
    const affectedMonths = [...new Set(toDelete.map(e => {
      const d = e.date instanceof Date ? e.date : new Date(String(e.date));
      return d.toISOString().slice(0, 7);
    }))];
    const deleted = await storage.bulkDeleteExpenses(userId, numericIds);
    for (const m of affectedMonths) await storage.markStatementRoastDirty(userId, m);
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

  // ─── Expenses: Update category + teach AI + auto re-roast ───────
  app.patch("/api/expenses/:id/category", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const expenseId = Number(req.params.id);
    const { category } = req.body;
    if (!category || typeof category !== "string") {
      return res.status(400).json({ message: "category is required" });
    }
    // Save category first
    const updated = await storage.updateExpense(expenseId, userId, { category });
    if (!updated) return res.status(404).json({ message: "Expense not found" });
    await storage.upsertCategoryRule(userId, updated.description, category);

    // Mark statement roast dirty for this expense's month so the Refresh button appears
    if (updated.date) {
      const month = new Date(updated.date).toISOString().slice(0, 7);
      await storage.markStatementRoastDirty(userId, month).catch(() => {});
    }

    // Auto re-roast with the corrected category so the roast reflects what the charge is for
    try {
      const user = await storage.getUser(userId);
      const currency = (updated as any).currency || user?.currency || "USD";
      let newRoast: string;
      if (updated.source === "receipt") {
        newRoast = await generateRoast(updated.description, updated.amount, category, "sergio", undefined, currency, updated.date);
      } else {
        newRoast = await generateBankTransactionRoast(updated.description, updated.amount, category, "sergio", currency, updated.date);
      }
      const withRoast = await storage.updateExpense(expenseId, userId, { roast: newRoast });
      return res.json(withRoast);
    } catch (err) {
      console.error("[category-update] re-roast failed:", err);
      return res.json(updated);
    }
  });

  // ─── Expenses: Re-roast after category change ────────────────────
  app.post("/api/expenses/:id/re-roast", isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const expenseId = Number(req.params.id);
    if (isNaN(expenseId)) return res.status(400).json({ message: "Invalid expense ID" });

    const all = await storage.getExpenses(userId);
    const expense = all.find(e => e.id === expenseId);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const tone = (req.body?.tone as string) || (expense.source === "receipt" ? "sergio" : "sergio");
    const currency = (expense as any).currency || "USD";

    let newRoast: string;
    if (expense.source === "receipt") {
      newRoast = await generateRoast(
        expense.description,
        expense.amount,
        expense.category,
        tone,
        undefined,
        currency,
        expense.date
      );
    } else {
      newRoast = await generateBankTransactionRoast(
        expense.description,
        expense.amount,
        expense.category,
        tone,
        currency,
        expense.date
      );
    }

    const updated = await storage.updateExpense(expenseId, userId, { roast: newRoast });
    return res.json({ roast: newRoast, expense: updated });
  });

  // ─── Expenses: Delete ────────────────────────────────────────────
  app.delete(buildUrl(api.expenses.delete.path).replace(":id", ":id"), isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    const id = Number(req.params.id);
    // Capture the expense's month before deleting so we can mark the roast dirty
    const expense = await storage.getExpenseById(id, userId);
    await storage.deleteExpense(id, userId);
    if (expense && expense.source !== "receipt") {
      const d = expense.date instanceof Date ? expense.date : new Date(String(expense.date));
      await storage.markStatementRoastDirty(userId, d.toISOString().slice(0, 7));
    }
    res.status(204).send();
  });

  return httpServer;
}
