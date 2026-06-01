<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mongui - Agent Guide

Mongui is a lightweight, self-hosted web UI for browsing and editing MongoDB. It is a maintained replacement for the deprecated mongo-express. The full product plan lives in `PLAN.md` and the detailed requirements in `REQUIREMENTS.md`. Read both before making feature decisions.

## Stack (pinned versions)

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.2.6 |
| Runtime | React | 19.2.4 |
| Language | TypeScript | 5.x |
| DB driver | `mongodb` (official Node driver) | 7.2.0 |
| Styling | Tailwind CSS | 4.x |
| Lint | ESLint + `eslint-config-next` | 9.x / 16.2.6 |

Planned additions (not yet installed): `shadcn/ui`, `@tanstack/react-table`, `@tanstack/react-query`, CodeMirror 6 (`@codemirror/lang-json`), `iron-session`, `bcryptjs`, `zod`.

## Project layout

```
src/
  app/
    login/page.tsx
    (dashboard)/
      layout.tsx                 # sidebar + auth guard
      page.tsx                   # DB/collection overview
      [db]/[collection]/page.tsx # document browser
    api/
      health/route.ts            # DONE - ping + server version
      auth/login/route.ts
      auth/logout/route.ts
      databases/route.ts
      databases/[db]/collections/route.ts
      databases/[db]/[collection]/docs/route.ts
      databases/[db]/[collection]/docs/[id]/route.ts
  lib/
    mongo.ts        # DONE - cached MongoClient singleton
    session.ts      # iron-session config + auth guard helper
    ejson.ts        # safe EJSON parse/serialize (ObjectId, Date, ...)
    validate.ts     # filter/body validation (zod)
```

## Non-negotiable rules

1. **Single connection model.** The app connects to exactly one MongoDB defined by `MONGODB_URI`. Do not add multi-connection logic; it is explicitly out of MVP scope (see `PLAN.md` section 4).
2. **Reuse the client singleton.** Never call `new MongoClient(...)` outside `src/lib/mongo.ts`. Import `getClient` / `getDb` instead. The singleton is cached on `globalThis` to survive hot reloads.
3. **EJSON end to end.** All document data crossing the API boundary must use Extended JSON via the driver's `BSON.EJSON`. Plain `JSON.stringify` silently corrupts `ObjectId`, `Date`, `Decimal128`, etc. Centralize parse/serialize in `src/lib/ejson.ts` and route all document I/O through it.
4. **Auth on every API route.** Every route under `src/app/api/` except `auth/login` must verify the session first and return 401 when absent. Use the shared guard from `src/lib/session.ts`.
5. **Honor READ_ONLY.** When `READ_ONLY=true`, all POST/PUT/DELETE handlers must reject writes with 403 before touching the database. Enforce this in one shared place, not per route.
6. **Validate and cap user input.** Run user-supplied filters, sorts, and projections through `src/lib/validate.ts` (zod). Always cap `limit` (max 200) and reject unparseable filters with 400.
7. **Confirm destructive actions.** Drop collection and delete document require explicit confirmation in the UI (typed name for drops).

## Conventions

- TypeScript strict mode; no `any` in committed code (use `unknown` + narrowing).
- API routes return `NextResponse.json(...)`; error shape is `{ status: "error", message: string }` with an appropriate HTTP code. Success health shape is `{ status: "ok", ... }`.
- Mark DB-touching routes `export const dynamic = "force-dynamic"` so they are never statically cached.
- Server Components by default; add `"use client"` only for interactive pieces (tables, editors, forms).
- Keep secrets in `.env.local` (gitignored). `.env.example` documents every variable.

## Commands

```bash
npm run dev      # dev server (Turbopack) on :3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
```

## Local MongoDB for testing

A MongoDB 7 instance is reachable at `mongodb://localhost:27017` on this machine (a `taxopliance-mongodb` container already publishes 27017). Verify connectivity with:

```bash
curl -s http://localhost:3000/api/health
# -> {"status":"ok","ping":true,"serverVersion":"7.0.34"}
```

## Build phases

See `PLAN.md` section 6. Status:

- [x] Phase 1 - Scaffold + Mongo singleton + `/api/health` (verified)
- [x] Phase 2 - Auth (login, iron-session, guards) (verified)
- [x] Phase 3 - Navigation (list dbs + collections) (verified)
- [x] Phase 4 - Browse (paginated document table) (verified)
- [x] Phase 5 - Query (filter/sort/projection) (verified)
- [x] Phase 6 - Read doc (CodeMirror detail view) (verified)
- [x] Phase 7 - Mutations (insert/edit/delete) (verified)
- [x] Phase 8 - Collection ops (create/drop) (verified)
- [x] Phase 9 - Polish (status badge, toasts, empty/loading states)
- [x] Phase 10 - Open-source prep (Docker, README, license, CI)

Note: auth uses a plaintext `ADMIN_PASSWORD` (hashed by the app at runtime),
not a precomputed `ADMIN_PASSWORD_HASH`.

Implement phases in order; each should leave the app runnable.
