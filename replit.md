# RoastMyWallet — replit.md

## Overview

**RoastMyWallet** is a tiered SaaS web app that lets users upload receipts or manually enter expenses, then uses AI to generate savage roasts of their spending habits. It has a Stripe-powered subscription model with Free, Premium, and Annual Report tiers.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 2 receipt uploads/month, AI roast, shareable card (watermarked), no history |
| **Premium** | $9.99/mo | Unlimited uploads, CSV import, full history, charts, tone selector, monthly roast summary, AI financial advice |
| **Annual Report** | $29.99 one-time | Full year analysis: behavioral insights, 5-year projection, 3 suggestions, PDF download |

---

## System Architecture

### Frontend (React + Vite)

- **Framework:** React 18 with TypeScript, bundled via Vite
- **Routing:** Wouter
- **State/Data fetching:** TanStack React Query v5
- **UI Components:** shadcn/ui with dark Synthwave/Brutalist theme
- **Animations:** Framer Motion
- **Charts:** Recharts (MonthlyTracker)
- **Styling:** Tailwind CSS, deep purple/magenta palette, glassmorphism panels

**Pages:**
| Route | Page | Access |
|-------|------|--------|
| `/` | Landing | Public |
| `/upload` | Receipt Roast | All tiers |
| `/bank` | Bank Statement | Premium (gated) |
| `/tracker` | Monthly Tracker | Premium (gated data) |
| `/pricing` | Pricing | All tiers |
| `/annual-report` | Annual Report | Annual purchase or Premium |
| `/upgrade/success` | Post-checkout fulfillment | Auth |

**Key hooks:**
- `use-auth.ts` — Replit Auth user state
- `use-expenses.ts` — expense CRUD + summary + series + financial advice
- `use-subscription.ts` — useMe, useStripeProducts, useCheckout, usePortal, useFulfill, useMonthlyRoast, useAnnualReport, useImportCSV

---

### Backend (Express + Node.js)

**Key API endpoints:**
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/me` | Auth | Full user with tier info |
| GET | `/api/expenses` | Premium | List saved expenses |
| POST | `/api/expenses/upload` | All | Upload receipt (free: 2/mo, no storage) |
| POST | `/api/expenses/manual` | Premium | Manual expense entry |
| POST | `/api/expenses/import-csv` | Premium | CSV bank statement import |
| POST | `/api/expenses/annual-report` | Annual/Premium | Generate annual report |
| GET | `/api/expenses/monthly-roast` | Premium | Monthly roast summary |
| GET | `/api/expenses/financial-advice` | Premium | AI financial advice |
| GET | `/api/stripe/products` | Public | Stripe products/prices |
| POST | `/api/stripe/checkout` | Auth | Create Stripe checkout session |
| POST | `/api/stripe/portal` | Auth | Customer billing portal |
| POST | `/api/stripe/fulfill` | Auth | Post-checkout fulfillment |

---

### Data Storage

- **Database:** PostgreSQL (Drizzle ORM)
- **Schema:** `shared/schema.ts`
- **Stripe data:** Stored in `stripe.*` schema (managed by stripe-replit-sync, NOT public schema)

**Tables (public schema):**
| Table | Purpose |
|-------|---------|
| `sessions` | Express sessions (Replit Auth) |
| `users` | User profiles + tier + Stripe IDs + upload tracking |
| `expenses` | Saved expenses (premium users only, free gets ephemeral response) |

**User fields added for subscriptions:**
- `tier`: 'free' | 'premium' (default: 'free')
- `stripeCustomerId`: Stripe customer ID
- `stripeSubscriptionId`: Active subscription ID
- `monthlyUploadCount`: Resets each month for free tier enforcement
- `monthlyUploadResetDate`: Tracks when count was last reset
- `hasAnnualReport`: Boolean for one-time annual report purchase

---

### Authentication

- **Provider:** Replit OIDC via openid-client + Passport.js
- **Sessions:** PostgreSQL-backed (connect-pg-simple), 7-day TTL
- **Protection:** `isAuthenticated` middleware on all `/api/expenses/*` and `/api/stripe/*` routes

---

### Stripe Integration

- **Package:** `stripe-replit-sync` (manages stripe schema + webhooks automatically)
- **Client:** `server/stripe/stripeClient.ts` (fetches credentials from Replit connector API)
- **Webhooks:** `server/stripe/webhookHandlers.ts` — MUST be registered before `express.json()`
- **Products:** Created via `scripts/seed-products.ts` (run once)
  - Premium: recurring monthly $9.99 (metadata: `plan: "premium"`)
  - Annual Report: one-time $29.99 (metadata: `plan: "annual_report"`)
- **Fulfillment flow:** checkout → `/upgrade/success?session_id=...` → `/api/stripe/fulfill` → user tier updated

---

### Roast Tones (Premium)

| Tone | Style |
|------|-------|
| Savage 🔥 | Maximum brutality (default) |
| Playful 😄 | Friendly ribbing |
| Supportive 💛 | Gentle honesty |

---

### Build & Deployment

- **Dev:** `tsx server/index.ts` (Vite embedded in Express)
- **Build:** `tsx script/build.ts`
- **Production:** `node dist/index.cjs`

### Environment Variables Required
```
DATABASE_URL              # PostgreSQL
SESSION_SECRET            # Express sessions
REPL_ID                   # Replit OIDC
ISSUER_URL                # Replit OIDC issuer
AI_INTEGRATIONS_OPENAI_API_KEY
AI_INTEGRATIONS_OPENAI_BASE_URL
REPLIT_CONNECTORS_HOSTNAME  # Stripe connector (auto-injected)
REPL_IDENTITY               # Stripe connector token (auto-injected)
GMAIL_APP_PASSWORD          # Gmail App Password for expenseroaster@gmail.com (contact form emails)
```

### Email (Contact Form)
- Contact form submissions are always saved to the `contact_submissions` DB table.
- Emails are sent via nodemailer + Gmail SMTP using `GMAIL_APP_PASSWORD` secret.
- **NOTE:** Resend integration was dismissed by user. Using Gmail SMTP instead. Do NOT attempt the Resend integration unless user requests it again.
- To get a Gmail App Password: Google Account → Security → 2-Step Verification → App passwords.

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| stripe | Stripe API client |
| stripe-replit-sync | Manages Stripe schema + webhooks |
| openai | AI roasting + advice |
| drizzle-orm | Database ORM |
| openid-client | Replit OIDC auth |
| recharts | Monthly spending charts |
| framer-motion | Animations |
| react-dropzone | File/image/CSV upload |
| @tanstack/react-query | Server state management |
| wouter | Client-side routing |
