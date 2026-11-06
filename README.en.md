<p align="center">
  <b>English</b> | <a href="./README.md">简体中文</a>
</p>

<div align="center">
  <img src="./public/rounded-image.png" width="110" alt="Points Store Logo" />

  <h1>Points Store · Student Reward Platform</h1>

  <p>
    <b>Teachers award, students redeem, admins manage stock</b> — a campus points system you can actually run in class.<br/>
    Self-hosted, 5-minute deploy, no server to maintain.
  </p>

  <p>
    <a href="https://github.com/GB233-grt/class-app/actions/workflows/ci.yml"><img src="https://github.com/GB233-grt/class-app/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Pages" />
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  </p>
</div>

<div align="center">
  <img src="./docs/screenshots/demo.gif" width="880" alt="Classroom mode roll call plus Excel bulk award demo" />
  <sub>30-second demo: classroom roll call → instant scoring → Excel bulk award with live preview</sub>
</div>

<br/>

## ⚡ Run it in 30 seconds

```bash
git clone https://github.com/GB233-grt/class-app.git && cd class-app
npm install
cp .env.example .env && cp .dev.vars.example .dev.vars   # fill in Supabase URL and anon key
npm run pages:dev                                        # → http://localhost:8788
```

For the database, run two files in the Supabase **SQL Editor**: `database/all-in-one/step1-schema.sql`, then `step2-seed.sql`.
Full setup (schema, accounts, migrations) is in [Quick Start](#quick-start); troubleshooting lives in the [Wiki](https://github.com/GB233-grt/class-app/wiki).

| Role | What they can do |
| --- | --- |
| 🎒 Student | See points balance and ledger, redeem prizes and study materials, view the leaderboard |
| 👩‍🏫 Teacher | Award points individually or via Excel, fulfil physical redemptions |
| 🛠️ Admin | Manage items and publish groups, schedule auto-expiry, free items, accounts and settings |

<details>
<summary><b>Table of Contents</b> (click to expand)</summary>

- [Quick Start](#quick-start)
- [Screenshots](#screenshots)
- [Features](#features)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
- [FAQ](#faq)
- [Roadmap](#roadmap) · [Changelog](#changelog)
- [Contributing](#contributing) · [License](#license) · [Tools and Credits](#tools-and-credits)

</details>

---

## Quick Start

### 0. Prerequisites

| Dependency | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 18 | Frontend build and local Functions runtime |
| Supabase | Free tier is enough | Database + authentication |
| Cloudflare | Free account | Only needed for deployment |

### 1. Install

```bash
git clone https://github.com/GB233-grt/class-app.git
cd class-app
npm install
```

### 2. Configure environment variables

```bash
# Frontend variables (injected by Vite at build time)
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env

# Local Functions variables (only read by npm run pages:dev)
cp .dev.vars.example .dev.vars
```

See [Configuration](#configuration) for every field. Both files are listed in `.gitignore`.

### 3. Initialise the database

**Brand-new database**: Supabase console → **SQL Editor**, run in order:

1. `database/all-in-one/step1-schema.sql` — tables + atomic functions + RLS
2. `database/all-in-one/step2-seed.sql` — sample seed data

**Upgrading an existing database**: run the scripts in `database/migrations/` you have not applied yet, in numeric order:

| Script | Content |
| --- | --- |
| `07_teacher_and_fulfillment.sql` | Teacher role + quantity redemption + fulfilment status |
| `08_batch_points_adjust.sql` | Bulk points adjustment (Excel) |
| `09_item_types.sql` | Item types (physical / digital) + download links |
| `10_system_settings.sql` | System settings table (self-service profile edit switch) |
| `11_fix_digital_redeem_points.sql` | **Fix**: digital items did not deduct points |
| `12_digital_stock_limit.sql` | **Fix**: digital items now respect stock (includes fix 11) |
| `13_allow_zero_cost_items.sql` | Allow zero-cost (free) items (includes fixes 11 and 12) |
| `14_item_expiry.sql` | Auto-unpublish items on expiry |

> Scripts 11, 12 and 13 all redefine the same database function — **only the newest one is required** (13 already contains the fixes from 11 and 12).

### 4. Create login accounts

**Authentication → Users → Add user**, create each account with a password (tick **Auto Confirm User**, otherwise login fails with an unverified email error):

- Admin: `admin@school.edu`
- Students: `student@school.edu`, `student2@school.edu`

The emails must match the `database/seed/` templates; the templates map `students.id` to `auth.users.id` via an email subquery.

### 5. Run it

```bash
npm run pages:dev     # build and serve the frontend + local API at http://localhost:8788
```

For frontend hot reload, use two terminals:

```bash
npm run pages:dev     # terminal 1: local Functions (:8788)
npm run dev           # terminal 2: Vite (:5173, /api proxied to 8788)
```

Open <http://localhost:5173> and sign in with an account from step 4.

### 6. Common commands

```bash
npm run dev         # frontend hot reload only (API requires pages:dev)
npm run build       # build into dist/
npm run typecheck   # TypeScript check (frontend + Functions)
npm test            # unit tests (Vitest)
npm run deploy      # build and deploy to Cloudflare Pages
```

---

## Screenshots

| Teacher · fulfilment queue | Admin · item management |
| --- | --- |
| <img src="./docs/screenshots/teacher.png" alt="Teacher fulfilment queue" /> | <img src="./docs/screenshots/admin.png" alt="Admin item management" /> |

| Classroom mode (projector) | Student · store |
| --- | --- |
| <img src="./docs/screenshots/classroom.png" alt="Classroom mode: roll call and instant scoring" /> | <img src="./docs/screenshots/student.png" alt="Student store" /> |

<details>
<summary>Login page</summary>

<img src="./docs/screenshots/login.png" alt="Login page" />

</details>

> Screenshots come from the real build output; the data is demo data injected by `tools/preview-server.mjs`, so no real database is needed.
> Regenerate with `npm run build && npm run preview:ui student 8801`, then capture `http://localhost:8801`.

---

## Features

### 🎒 Students

- **Points wallet**: large points card with a greeting
- **Store**: card grid; shows "Sold out" at zero stock and "Not enough points" otherwise
- **Redemption history**: item name, points spent, time, download link and fulfilment status
- **Points ledger**: reason, delta and balance after every award or deduction
- **Leaderboard**: campus-wide ranking by points
- **Account settings**: change password (old password required), edit nickname/student ID (can be disabled by admin), delete account

### 👩‍🏫 Teachers

- **Classroom mode** (projector-ready): fullscreen big buttons, one-tap random roll call plus instant scoring; `Space` to roll, `+/-` to score, `Esc` to exit
- **Fulfilment queue**: review student and item, then mark as delivered
- **Award points**: add or deduct points for one student with a required reason
- **Bulk award**: drag-and-drop an Excel sheet → formula validated live → per-row preview (ready / skipped / invalid) → filter to problem rows only → atomic commit

### 🛠️ Admins

- **Overview**: item count, total stock, total points awarded
- **Item management**: two groups (Published / Unpublished), toggle visibility at any time
- **System settings**: toggle whether students may edit their own nickname / student ID
- **Accounts**: create student/teacher accounts, provisioning the login account too

### 🎁 Item capabilities

| Capability | Description |
| --- | --- |
| Physical item | Has stock; redemption creates a "pending" record for a teacher to hand out |
| Digital item | Has stock; redemption **auto-fulfils** and delivers a download link immediately |
| Free item | Set price to **0**; costs no points but is still stock-limited |
| Auto-expiry | Set an expiry time; the item is unpublished automatically when it passes, history is kept |
| Stock control | Both item types are stock-limited; sold out once stock reaches 0 |

---

## Usage Examples

### Student: redeem a digital item

1. Sign in → open **Store**
2. Pick an item and click **Redeem now** (free items show **Redeem for free**)
3. A digital item appears in **Redemption history** immediately with a download link; a physical item becomes "Pending"

### Teacher: award points to a whole class

1. **Bulk award** → upload the Excel sheet (student ID + score column)
2. Pick a scoring formula → preview how many students match → confirm
3. Each student's **Points ledger** gains an entry right away

### Admin: publish a time-limited free resource

1. **Item management** → add item
2. Type **Digital**, price `0`, stock `50`, fill in the download link
3. Set the expiry date two weeks out → save
4. The item shows up under **Published**; two weeks later it moves to **Unpublished** automatically

### Calling the API directly

```bash
# 1) Sign in and grab an access_token
curl -X POST "https://<your-domain>/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"student@school.edu","password":"your-password"}'

# 2) List items
curl "https://<your-domain>/api/items" -H "Authorization: Bearer <access_token>"

# 3) Redeem an item
curl -X POST "https://<your-domain>/api/redemptions" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"item_id":"<item-uuid>","quantity":1}'
```

Errors always come back as `{ "error": "message in Chinese" }`.

---

## Configuration

### Frontend variables (`.env`)

| Variable | Required | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | ✅ | string | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | string | — | Supabase anon key (public by design) |

Where to find them: Supabase console → **Project Settings → API**.

### Backend variables (`.dev.vars` locally / Cloudflare env vars in production)

| Variable | Required | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | ✅ | string | — | Same as above |
| `SUPABASE_ANON_KEY` | ✅ | string | — | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **secret** | — | Service role key, backend only — **never leak or commit it** |

> In production, configure `SUPABASE_SERVICE_ROLE_KEY` as a Cloudflare **Secret (encrypted)**, not as plain text.

### Tunable values in code

| Location | Parameter | Default | Description |
| --- | --- | --- | --- |
| `src/lib/constants.ts` | `POINT_REASONS` | A set of common reasons | Suggestions for the award reason field; append to extend |
| `src/lib/validation.ts` | Password strength rules | 8+ chars, upper, lower, digit, symbol | Validation used when changing a password |

---

## Architecture

### Directory Structure

```text
class-app/
├── database/                      # SQL scripts (run manually in Supabase SQL Editor)
│   ├── migrations/                # Incremental migrations 01 → 14
│   ├── all-in-one/                # One-shot schema + seed for a fresh database
│   ├── tests/                     # DB function tests (transaction + rollback)
│   └── seed/                      # Seed templates (never run automatically)
├── functions/                     # Cloudflare Pages Functions (backend)
│   ├── api/
│   │   ├── _middleware.ts         # CORS and unified error handling
│   │   ├── auth/                  # Login / refresh / logout / reset & change password
│   │   ├── items/                 # Item CRUD + publish/unpublish toggle
│   │   ├── students/              # Roster / create account / award / bulk award
│   │   ├── redemptions/           # Redeem / list / fulfilment status
│   │   ├── ledger/                # Points ledger
│   │   ├── user/                  # Profile / account deletion / visible settings
│   │   ├── admin/                 # System settings management (admin only)
│   │   ├── leaderboard.ts         # Leaderboard
│   │   └── stats.ts               # Overview statistics
│   └── lib/                       # Auth guards, HTTP helpers, Supabase client factories
├── docs/screenshots/              # README screenshots
├── public/                        # Static assets (logo, import template)
├── src/                           # Frontend (React + Vite)
│   ├── api/                       # Fetch client and endpoint definitions
│   ├── components/                # common / layout / feature layers
│   ├── hooks/                     # useAuth / useItems / useStudents / useToast …
│   ├── lib/                       # Validation, constants, utilities (+ unit tests)
│   ├── pages/                     # Three dashboards + login page
│   └── types/                     # TypeScript types
├── tools/preview-server.mjs       # Local preview server (for README screenshots)
├── .github/workflows/ci.yml       # CI: typecheck + test + build
├── index.html
├── wrangler.toml                  # Cloudflare Pages configuration
├── .env.example                   # Frontend variable template
└── .dev.vars.example              # Backend variable template
```

### Data Flow

```mermaid
flowchart LR
  A["Browser<br/>React SPA"] -->|"fetch + Bearer JWT"| B["Cloudflare Pages<br/>Functions"]
  B -->|"verify session & role"| C["Supabase Auth"]
  B -->|"service_role / user token"| D["Supabase PostgREST"]
  D --> E[("PostgreSQL<br/>students / items / redemptions<br/>points_ledger / system_settings")]
  E -->|"SECURITY DEFINER"| F["Atomic functions<br/>adjust_student_points<br/>redeem_item<br/>expire_items"]
```

**Layering rule**: frontend goes `api client → hooks → components`, backend goes `route → middleware (auth) → Supabase client factory`. Each side depends only on the layer below.

### Data Consistency

All points and stock writes are wrapped in database functions and commit **atomically in a single transaction**:

- `adjust_student_points`: lock the student row → validate balance → update → append a ledger entry
- `redeem_item`: lock the item row → validate published / stock / balance → deduct points and stock → write the redemption (with an **item name and price snapshot**) → append a ledger entry
- `expire_items`: unpublish every published item whose `expires_at` has passed (lazy cleanup, invoked by both the item list and the redemption endpoint)

### Testing

| Layer | Location | How to run |
| --- | --- | --- |
| Frontend unit tests | `src/lib/*.test.ts` (40 cases: form validation, password strength, datetime round-trip) | `npm test` |
| Database functions | `database/tests/redeem_item.test.sql` (5 scenarios: deduct points/stock, out of stock, insufficient points, free item) | Paste into the Supabase SQL Editor; runs in a transaction and rolls back |
| Continuous integration | `.github/workflows/ci.yml` | typecheck + test + build on every push / PR |

### Security Model

- All writes go through the backend; the browser never receives the `service_role` key
- RLS is enabled: ordinary user credentials get SELECT-only access, and only to their own rows
- Student-side mutations run through `SECURITY DEFINER` functions that re-check `auth.uid()`
- Changing a password or deleting an account both **require the current password**
- Passwords are salted and hashed by Supabase Auth

---

## API Reference

Except for the login endpoints, every request must carry `Authorization: Bearer <Access Token>`.

<details>
<summary><b>Expand the full endpoint list</b></summary>

### Authentication

| Method | Path | Description | Access |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Email + password login | Public |
| POST | `/api/auth/refresh` | Refresh the access token | Public |
| POST | `/api/auth/logout` | Log out | Signed in |
| GET | `/api/auth/me` | Current user profile | Signed in |
| POST | `/api/auth/reset-password` | Send a password reset email | Public |
| POST | `/api/auth/change-password` | Change password (verifies the old one) | Signed in |

### Items

| Method | Path | Description | Access |
| --- | --- | --- | --- |
| GET | `/api/items` | List items (students only see published ones) | Signed in |
| POST | `/api/items` | Create an item | Admin |
| PUT | `/api/items/:id` | Update an item | Admin |
| DELETE | `/api/items/:id` | Soft delete (unpublish) | Admin |
| POST | `/api/items/:id/status` | Publish / unpublish | Admin |

### Students and points

| Method | Path | Description | Access |
| --- | --- | --- | --- |
| GET | `/api/students` | Student roster | Staff |
| POST | `/api/students` | Create an account | Admin |
| POST | `/api/students/award` | Award or deduct points | Staff |
| POST | `/api/students/award-batch` | Bulk award or deduct | Staff |
| GET | `/api/ledger/:studentId` | Points ledger | Owner / staff |
| GET | `/api/leaderboard` | Points leaderboard | Signed in |

### Redemptions and statistics

| Method | Path | Description | Access |
| --- | --- | --- | --- |
| POST | `/api/redemptions` | Redeem an item | Signed in |
| GET | `/api/redemptions` | All redemptions | Staff |
| GET | `/api/redemptions/:studentId` | A student's redemptions | Owner / staff |
| POST | `/api/redemptions/:id/status` | Update fulfilment status | Staff |
| GET | `/api/stats` | Overview statistics | Admin |

### Profile and system settings

| Method | Path | Description | Access |
| --- | --- | --- | --- |
| GET | `/api/user` | Current user profile | Signed in |
| PUT | `/api/user` | Update nickname / student ID | Signed in (behind a switch) |
| DELETE | `/api/user` | Delete account (verifies the old password) | Signed in |
| GET | `/api/user/system-settings` | Read user-visible settings | Signed in |
| GET | `/api/admin/system-settings` | Read all system settings | Admin |
| POST | `/api/admin/system-settings` | Update system settings | Admin |

</details>

---

## Deploy to Cloudflare Pages

1. Push the code to GitHub / GitLab
2. Cloudflare console → **Workers & Pages → Create → Pages → Connect to Git**
3. Build settings:

   | Field | Value |
   | --- | --- |
   | Framework preset | Vite (or None) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

4. Add production variables under **Settings → Environment variables**:

   | Variable | Type |
   | --- | --- |
   | `SUPABASE_URL` | Text |
   | `SUPABASE_ANON_KEY` | Text |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Secret** |

5. Click **Deploy**; `functions/` is picked up as Pages Functions automatically
6. (Optional) Bind a custom domain under **Custom domains**

### Keeping a free project alive

Supabase free-plan projects pause after 7 days without activity. The repo ships `.github/workflows/keep-alive.yml`, which pings the project daily at 12:00 UTC:

1. **Settings → Secrets and variables → Actions → Variables**: add `SUPABASE_URL` (e.g. `https://xxxx.supabase.co`)
2. Optionally add `SUPABASE_ANON_KEY` so the REST ping carries an `apikey` header
3. **Actions → Supabase Keep-Alive → Run workflow** to verify it once

> GitHub disables scheduled workflows after 60 days without commits — trigger it manually now and then, or keep committing.

You can also deploy from the command line:

```bash
npm run deploy      # run `npx wrangler login` first
```

---

## FAQ

**Login says "wrong email or password"?**
Make sure the user exists under Authentication → Users and the email is confirmed.

**Login says "user profile does not exist"?**
There is no matching row in `students` for that auth user. Run `database/seed/01_create_admin.sql` and `02_create_students.sql`, or insert the row manually.

**"Server is missing SUPABASE_SERVICE_ROLE_KEY"?**
Add the service role key to `.dev.vars` or the Cloudflare environment variables, then restart / redeploy.

**`npm run dev` returns 404 for API calls?**
`vite dev` only serves the frontend. Run `npm run pages:dev` alongside it.

**Redemption says "not enough points / not enough stock"?**
Ask an admin to award points or restock. Database functions guarantee no overselling under concurrency.

**What is the difference between an item's "stock" and "download limit"?**
`stock` decides how many times the item can be redeemed. `download_limit` is currently **stored but not enforced** — there is no counting download proxy, so students receive the original link.

**Why is an expired item still listed as Published?**
Expiry cleanup is lazy: it runs when someone loads the item list or starts a redemption. Refresh the item management page.

**Can a student bypass the UI and change points directly?**
No. RLS denies writes with ordinary credentials.

---

## Roadmap

- [x] Three consoles (student / teacher / admin)
- [x] Atomic points and stock, no overselling
- [x] Physical items + digital items (auto-delivery)
- [x] Bulk Excel awarding
- [x] Item grouping, publishing toggle, free items, auto-expiry
- [x] Account settings (password / profile / deletion)
- [x] Unit tests and CI
- [ ] Enforced download limit (counting download proxy)
- [ ] Export redemption history to Excel
- [ ] In-app notifications
- [ ] Mobile PWA

Feature requests are welcome in Issues.

---

## Changelog

See the [commit history](https://github.com/GB233-grt/class-app/commits/main).
After every database upgrade, redeploy (`npm run deploy`) so the backend matches the schema.

---

## Contributing

Full rules live in **[CONTRIBUTING.en.md](./CONTRIBUTING.en.md)**; the short version:

1. Fork and branch off `main`: `git checkout -b feat/your-feature`
2. Make sure `npm run typecheck`, `npm test` and `npm run build` pass
3. For schema changes **add** a migration script; never edit a released one
4. Prefix commits with `feat:` / `fix:` / `docs:` / `refactor:`
5. Open a PR describing motivation, blast radius and how you verified it

**First time?** Issues labelled [`good first issue`](https://github.com/GB233-grt/class-app/labels/good%20first%20issue) are reserved for newcomers — just reply "I'll take this".

---

## License

Released under the [MIT License](./LICENSE).

---

## Tools and Credits

This project was designed and implemented by the author, who owns the decisions and the final code. The following AI coding assistants were used as **tools** during development, for assisted coding, design discussion and documentation drafting.

| Tool | Involvement |
| --- | --- |
| 🧠 [Zhipu GLM](https://www.zhipuai.cn/) | Assisted design, implementation, documentation and coding |
| 🐋 [DeepSeek](https://www.deepseek.com/) | Assisted design, implementation, documentation and coding |
| ☁️ [Alibaba Qwen](https://tongyi.aliyun.com/qianwen/) | Project structure and foundational guidance |
| 🔬 [Shanghai AI Laboratory](https://www.shlab.org.cn/) | Assisted design, implementation, documentation and coding |

### Technologies and services

- [React](https://react.dev) · [Vite](https://vitejs.dev) · [Tailwind CSS](https://tailwindcss.com)
- [Lucide](https://lucide.dev) icons · [Vitest](https://vitest.dev) test runner
- [Supabase](https://supabase.com) for managed PostgreSQL and authentication
- [Cloudflare Pages](https://pages.cloudflare.com) for static hosting and edge functions
- Every teacher and student who actually uses it in class

<p align="center"><sub>If this project helps you, a ⭐ Star is appreciated</sub></p>
