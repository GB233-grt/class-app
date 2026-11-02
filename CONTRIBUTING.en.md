<p align="center">
  <a href="./CONTRIBUTING.md">简体中文</a> | <b>English</b>
</p>

# Contributing

Thanks for taking the time to improve this project. This guide covers local setup, commit conventions, and which issues are friendly to first-time contributors.

## Table of Contents

- [First time here? Start with these](#first-time-here-start-with-these)
- [Development setup](#development-setup)
- [Branches and commits](#branches-and-commits)
- [Database change rules](#database-change-rules)
- [Checks before committing](#checks-before-committing)
- [Pull request flow](#pull-request-flow)
- [Code style](#code-style)

---

## First time here? Start with these

You do not need to dive into the core logic first. These changes are small, well-scoped and need no database access — perfect for a first PR:

| Type | Examples | Files |
| --- | --- | --- |
| 📝 Docs | Add troubleshooting steps, fix typos, add Windows commands | `README.md`, `README.en.md` |
| 🎨 Copy | Make error messages more specific | `src/components/**` |
| ♿ A11y | Add `aria-label`, improve tab order | `src/components/common/**` |
| 🧪 Tests | Add edge cases for pure functions | `src/lib/*.test.ts` |
| 🌐 i18n | Proofread the English README | `README.en.md` |
| 🐛 Small fixes | Empty states, mobile wrapping, icon alignment | See the issue list |

> Issues labelled [`good first issue`](https://github.com/GB233-grt/class-app/labels/good%20first%20issue) are waiting for you.
> Just reply "I'll take this" — no approval needed.

**Avoid** touching `database/migrations/` on your first PR — those functions guarantee atomicity of points and stock, and a mistake affects real data.

---

## Development setup

```bash
git clone https://github.com/GB233-grt/class-app.git
cd class-app
npm install

cp .env.example .env
cp .dev.vars.example .dev.vars
```

See [Configuration](README.en.md#configuration) for the variables and [Quick Start](README.en.md#quick-start) for database setup.

Run it:

```bash
npm run pages:dev     # frontend + local API (:8788)
npm run dev           # frontend hot reload only (:5173, needs pages:dev alongside)
```

---

## Branches and commits

Branch naming:

```
feat/short-description
fix/short-description
docs/short-description
refactor/short-description
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: auto-unpublish items on expiry
fix: digital redemptions did not deduct stock
docs: add the Windows copy command for env files
```

One concern per commit; keep formatting-only changes separate.

---

## Database change rules

1. **Add, never edit**: never modify a released `database/migrations/NN_xxx.sql` — add `NN+1_xxx.sql` instead
2. Scripts must be re-runnable (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` / `CREATE OR REPLACE`)
3. When redefining a function, note in the header whether the script already includes earlier fixes
4. Keep `database/all-in-one/step1-schema.sql` in sync so fresh installs and upgrades end up identical
5. Before opening a PR, run the `all-in-one` scripts on an empty database to confirm there are no ordering issues

> For changes touching redemption or points, extend `database/tests/redeem_item.test.sql` and run it in the Supabase SQL Editor — it wraps everything in a transaction and rolls back.

---

## Checks before committing

```bash
npm run typecheck   # TypeScript (app + Functions)
npm test            # unit tests
npm run build       # production build
```

CI runs the same checks, so passing locally saves a round trip.

---

## Pull request flow

1. Fork the repo and branch off `main`
2. Make the change and verify it yourself
3. Open a PR using the template:
   - what problem it solves (link the issue)
   - blast radius (student / teacher / admin / database)
   - how you verified it — especially for permission-related changes
4. Attach before/after screenshots for UI changes
5. A maintainer merges once reviewed

A PR does not need to be perfect — **clear motivation and verification** matter more than volume.

---

## Code style

- TypeScript strict mode, avoid `any`
- Function components with hooks; put business logic in `src/hooks/`
- Use Tailwind utility classes; no extra CSS files
- Comments and UI copy are in Chinese (consistent with the existing codebase)
- Components live in three layers: `common` / `layout` / `feature`

No manual formatting step required — just match the surrounding style.
