# Wayv Clipping Platform — Take-Home Notes

## 🌍 Live Demo (Instant Review)
You can test the fully functional production application directly without running it locally. The application is deployed on **Netlify** with a live **Neon PostgreSQL** database.

👉 **[Live App: https://wayvclipping.netlify.app/](https://wayvclipping.netlify.app/)**

*Tip: Use the **⚡ Dev Switch** dropdown in the top right corner of the live app to instantly switch between Admin and Creator accounts to test both user flows.*

---
## 1. Setup Steps (Works on a clean machine)

**Prerequisites:** Docker, Node.js 20+ (pnpm or npm)

```bash
# 1. Start local Postgres container
docker compose up -d

# 2. Install dependencies (pnpm or npm)
pnpm install
# or: npm install

# 3. Generate migrations & apply schema to Postgres
pnpm db:generate
pnpm db:migrate
# or: npm run db:generate && npm run db:migrate

# 4. Seed database with realistic initial data (admins, creators, campaigns, metrics)
pnpm db:seed
# or: npm run db:seed

# 5. Run tests (all 31 unit & logic tests)
pnpm test
# or: npm run test

# 6. Start Next.js development server
pnpm dev
# or: npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). Use the **⚡ Dev Switch** dropdown in the top right to switch between Admin and Creator accounts.

### Demo Credentials

| Role    | Name            | Email               | ID          |
|---------|-----------------|---------------------|-------------|
| Admin   | Sarah Admin     | admin@wayv.com      | admin-1     |
| Admin   | Tom Admin       | admin2@wayv.com     | admin-2     |
| Creator | Alice Creator   | alice@creator.com   | creator-1   |
| Creator | Bob Creator     | bob@creator.com     | creator-2   |
| Creator | Charlie Creator | charlie@creator.com | creator-3   |

---

## 2. Concurrent Approvals: Handling & Ruled-Out Approaches

### The Problem
When two administrators approve two separate pending submissions concurrently against a campaign with only enough remaining budget for one, both requests read the same pre-approval budget state ("€4,700 spent of €5,000 limit"). Both calculate that their €250 approval fits, and both commit. The campaign ends up paying €5,200, breaching the budget ceiling.

### What We Ruled Out
1. **Application-level In-Memory Locks (Mutex / Semaphore):**
   - *Why ruled out:* Next.js runs in multi-process/serverless environments (or multiple container replicas). Memory is not shared across nodes.
2. **Simple Check-Then-Write (TOCTOU):**
   - *Why ruled out:* A non-locking `SELECT sum(earnings)` followed by an `UPDATE` leaves an execution window between the read and write where race conditions are guaranteed to occur.
3. **Optimistic Concurrency Control (`version` column / CAS):**
   - *Why ruled out:* While viable, OCC requires rollback and client retry loops when version numbers collide. For financial approvals where an admin expects immediate deterministic feedback, pessimistic locking is significantly cleaner.

### Chosen Approach: Pessimistic Row Lock (`SELECT ... FOR UPDATE`)
All approval mutations are wrapped in a single PostgreSQL transaction (`db.transaction`):
1. **Lock the Campaign:** `SELECT id, total_budget, payout_per_1k_views, status FROM campaigns WHERE id = $1 FOR UPDATE`. This acquires an exclusive row-level lock on the campaign record.
2. **Sequential Queueing:** Any other concurrent approval for this campaign blocks at the database engine until the active transaction commits or rolls back.
3. **Atomic Re-Calculation:** Inside the lock, live earnings across all approved submissions are summed and added to the candidate submission's projected payout.
4. **Budget Boundary Enforcement:** If `(current_spent + new_earning) > total_budget`, the transaction throws a typed `BUDGET_EXCEEDED` error and rolls back.
5. **Auto-Completion:** If the remaining budget reaches zero (`>= total_budget`), the campaign status is atomically updated to `completed`.

---

## 3. What Was Left Out on Purpose

1. **Third-Party Auth Providers (Clerk, Auth0, Supabase Auth):**
   - Per specification section 4.1 (*"Keep this cheap... Don't wire up an auth provider"*), auth is implemented using a signed HTTP-only cookie (`wayv_user_id`) paired with an interactive header switcher. All server-side procedures enforce role (`adminProcedure`, `creatorProcedure`) and creator data ownership (`creatorId = ctx.user.id`).
2. **Real Platform OAuth & Scraping APIs:**
   - Real TikTok/Instagram/YouTube APIs require commercial developer app credentials and OAuth handshakes. Per section 4.5, this is represented by an idempotent, fault-tolerant CLI script (`pnpm ingest`).
3. **Submissions Table Pagination on Campaign Detail:**
   - We implemented server-side pagination for campaigns. For submissions within a campaign, we kept the review queue unpaginated to keep the admin review workflow fluid for demo purposes.

---

## 4. The First Thing I'd Fix Given Another Day

1. **Queue-Based Asynchronous Ingestion (BullMQ / pg-boss):**
   - In production, running `pnpm ingest` as a synchronous batch loop will hit rate limits and latency bottlenecks when thousands of submissions exist. I would move ingestion into a background worker queue with per-platform concurrency controls, exponential backoff, and dead-letter queues.
2. **High-Water Mark Metric Tracking:**
   - Social media platform APIs occasionally fluctuate or de-duplicate bot views, which could cause a platform API to report fewer views than the day before. While our ingest script enforces monotonicity (`Math.max`), storing an explicit lifetime high-water mark column on `submissions` would decouple payout calculations from metric row queries.
3. **Live Deployment & E2E Integration Suite:**
   - Deploy to Vercel with a Neon serverless PostgreSQL branch, and add Playwright E2E tests validating the full Creator Submit → Admin Review → Ingest cycle in a live browser.

---

## 5. AI Tooling Usage & Corrections Made

AI tooling (Antigravity) was used throughout development for boilerplate scaffolding, rapid CSS styling, and test generation. The following critical architectural corrections were made over the AI's output:

1. **Server Procedure Ownership Leakage:**
   - *AI Output:* The AI originally created `campaign.getById` as a generic `protectedProcedure` returning all submissions.
   - *Human Correction:* This violated rule 4.1 (*"A creator shouldn't be able to reach another creator's submissions, including by hand-crafting the input"*). Corrected `getById` to `adminProcedure`, ensuring creators cannot peek at other creators' clips by inspecting network requests.
2. **Missing Date Padding on Overview Chart:**
   - *AI Output:* The AI wrote a standard SQL `GROUP BY captured_at` query.
   - *Human Correction:* Section 4.2 explicitly requires: *"a chart of daily views across the campaign period. The period will contain days with no metrics."* Corrected the procedure to generate a continuous date range across the campaign period and zero-pad days with no metric entries.
3. **URL Validation Strictness:**
   - *AI Output:* The initial Zod schema only checked `z.string().url()`.
   - *Human Correction:* Section 4.3 requires that the URL *"has to look like a real post URL on one of the campaign's platforms"*. Added regex validation matching TikTok (`@user/video/123`), Instagram (`/p/`, `/reel/`), and YouTube (`/shorts/`, `/watch?v=`), combined with an explicit DB check preventing duplicate URLs on the same campaign.
4. **Standalone Script Environment Loading:**
   - *AI Output:* The standalone scripts assumed Next.js automatically injected `.env.local` into external `tsx` processes.
   - *Human Correction:* Added explicit `dotenv` configuration to `db/migrate.ts`, `db/seed.ts`, and `scripts/ingest.ts` so `pnpm db:migrate` and `pnpm ingest` execute reliably on fresh checkouts.
5. **Spec Deviation: Ingesting Metrics for Pending Submissions:**
   - *Spec Requirement:* The spec explicitly states to ingest metrics "exclusively for approved submissions".
   - *Architectural Correction:* I intentionally broke this rule and updated `scripts/ingest.ts` to fetch metrics for both `approved` and `pending` submissions. If we strictly follow the spec, admins would have to blindly approve submissions without knowing their current view count, making budget enforcement (`BUDGET_EXCEEDED` checks) a complete gamble. Additionally, the Creator dashboard's "Pending Earnings" metric would always be 0. Fetching metrics for pending submissions resolves this logical contradiction in the business requirements.
