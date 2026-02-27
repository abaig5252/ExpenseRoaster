# RoastMyWallet — replit.md

## Overview

**RoastMyWallet** is a humorous personal finance web app that lets users upload receipts or manually enter expenses, then uses AI (OpenAI) to generate "roasts" — funny, brutally honest commentary about their spending habits. It also provides monthly spending charts, category breakdowns, financial advice, and supports bank statement entry.

Core features:
- Receipt image upload → AI scans and categorizes, stores the expense, and generates a witty roast
- Manual expense entry (for bank statement items or individual transactions)
- Monthly spending tracker with bar charts
- AI-generated financial advice based on the user's expense history
- Scrolling marquee of recent roast quotes
- Authentication via Replit OIDC (OpenID Connect)

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend (React + Vite)

- **Framework:** React 18 with TypeScript, bundled via Vite
- **Routing:** Wouter (lightweight client-side router)
- **State/Data fetching:** TanStack React Query (v5) for all server state; no Redux or Zustand
- **UI Components:** shadcn/ui (Radix UI primitives + Tailwind CSS), extended with custom glassmorphism styling
- **Animations:** Framer Motion for page transitions and micro-interactions
- **File uploads:** react-dropzone for drag-and-drop receipt and bank statement image uploads
- **Charts:** Recharts (bar charts in MonthlyTracker)
- **Styling:** Tailwind CSS with a dark "Synthwave/Brutalist" theme — deep purple/magenta palette, glassmorphism panels, CSS variables for all colors
- **Fonts:** Bricolage Grotesque (display), Syne (body), loaded from Google Fonts

**Pages:**
| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing | Public marketing page; redirects authenticated users |
| `/upload` | Upload | Receipt drop zone + expense list with roasts |
| `/bank` | BankStatement | Manual expense entry form + list |
| `/tracker` | MonthlyTracker | Monthly bar chart + category breakdown + AI advice |

**Key client hooks:**
- `use-auth.ts` — wraps `/api/auth/user` query; handles login/logout redirects
- `use-expenses.ts` — all expense CRUD, summary, monthly series, financial advice queries
- `use-toast.ts` — internal toast notification state

**Path aliases:** `@/` → `client/src/`, `@shared/` → `shared/`

---

### Backend (Express + Node.js)

- **Framework:** Express.js, served via `tsx` in dev, compiled with esbuild for production
- **Entry:** `server/index.ts` → registers routes, sets up Vite middleware (dev) or static serving (prod)
- **API routes:** Defined in `server/routes.ts`, all prefixed `/api/`
- **Route typing:** `shared/routes.ts` defines typed API spec (method, path, input/output schemas via Zod)
- **Storage layer:** `server/storage.ts` — `DatabaseStorage` class implementing `IStorage` interface; all DB calls go through this abstraction

**Key API endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/expenses` | List all user expenses |
| POST | `/api/expenses/upload` | Upload receipt image, AI extracts and roasts |
| POST | `/api/expenses/manual` | Add manual expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/expenses/summary` | Monthly total + recent roasts |
| GET | `/api/expenses/monthly-series` | Month-by-month totals |
| GET | `/api/expenses/financial-advice` | AI-generated financial advice |
| GET | `/api/auth/user` | Current authenticated user |

**Replit integration modules** (under `server/replit_integrations/`):
- `auth/` — Replit OIDC auth, session management, user upsert
- `audio/` — Voice recording/playback utilities (template, not active in main app)
- `chat/` — Chat conversation storage (template, not active in main app)
- `image/` — Image generation routes (template, not active in main app)
- `batch/` — Batch processing with rate limiting/retry (utility, not active in main app)

---

### Data Storage

- **Database:** PostgreSQL (via `pg` driver)
- **ORM:** Drizzle ORM with `drizzle-zod` for schema → Zod type generation
- **Schema file:** `shared/schema.ts` (single source of truth for all tables and types)
- **Migrations:** Drizzle Kit (`drizzle-kit push` for schema sync)

**Tables:**
| Table | Purpose |
|-------|---------|
| `sessions` | Express session storage (connect-pg-simple) — required by Replit Auth |
| `users` | User profiles synced from Replit OIDC |
| `expenses` | All expense records (userId FK, amount in cents, description, category, roast, imageUrl, source) |

Amounts are stored as **integers in cents** to avoid floating-point issues.

---

### Authentication

- **Provider:** Replit OIDC (OpenID Connect) via `openid-client` + Passport.js
- **Strategy:** OIDC with `passport-local`-style strategy; tokens memoized for 1 hour
- **Sessions:** Stored in PostgreSQL via `connect-pg-simple`; 7-day TTL; `httpOnly + secure` cookies
- **User sync:** On login, user profile is upserted into the `users` table
- **Route protection:** `isAuthenticated` middleware applied to all `/api/expenses/*` routes
- **Frontend:** `use-auth.ts` checks `/api/auth/user`; protected routes redirect to `/api/login` if not authenticated

---

### Build & Deployment

- **Dev:** `tsx server/index.ts` — Vite dev server embedded in Express via middleware mode
- **Build:** `tsx script/build.ts` — runs Vite for client, then esbuild for server (CJS bundle)
- **Production:** `node dist/index.cjs` — serves pre-built static files from `dist/public/`
- **Server bundle:** Key dependencies (OpenAI, drizzle, pg, express, stripe, etc.) are bundled into the server CJS file to reduce cold start times; others are kept external

---

## External Dependencies

| Service / Package | Purpose |
|-------------------|---------|
| **OpenAI API** | Receipt scanning + roast generation + financial advice (via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` env vars) |
| **Replit OIDC** | User authentication (`ISSUER_URL`, `REPL_ID`, `SESSION_SECRET` env vars) |
| **PostgreSQL** | Primary database (`DATABASE_URL` env var required) |
| **Google Fonts** | Bricolage Grotesque + Syne font families |
| **Recharts** | Bar charts for monthly spending visualization |
| **Framer Motion** | Animations and page transitions |
| **react-dropzone** | Drag-and-drop file/image upload |
| **Radix UI / shadcn** | Accessible UI primitives |
| **Drizzle ORM** | Type-safe database access and migrations |
| **connect-pg-simple** | PostgreSQL-backed session store |
| **TanStack React Query** | Server state management and caching |
| **Wouter** | Lightweight client-side routing |
| **Zod** | Input validation on both client and server |
| **date-fns** | Date formatting utilities |

### Environment Variables Required
```
DATABASE_URL          # PostgreSQL connection string
SESSION_SECRET        # Express session secret
REPL_ID               # Replit app ID (for OIDC)
ISSUER_URL            # Replit OIDC issuer (default: https://replit.com/oidc)
AI_INTEGRATIONS_OPENAI_API_KEY   # OpenAI API key
AI_INTEGRATIONS_OPENAI_BASE_URL  # OpenAI base URL (Replit proxy)
```