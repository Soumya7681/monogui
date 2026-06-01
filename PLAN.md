# Plan: Mongui (a maintained Mongo Express replacement)

> Stack decisions: **Next.js full-stack**, **Core CRUD MVP**, **single connection via env var + UI login**.

## 1. Goal & positioning
A lightweight, self-hosted web UI to browse and edit MongoDB, filling the gap left by the deprecated mongo-express. Single Next.js app, configured by one `MONGODB_URI`, protected by a login. Built clean from day one so it can be open-sourced.

## 2. Tech stack
| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router, TypeScript) | One codebase for UI + API routes |
| DB driver | `mongodb` (official Node driver) | Direct, no ODM overhead, full feature access |
| UI | React + Tailwind CSS + shadcn/ui | Fast, clean, accessible components |
| Data tables | TanStack Table | Sorting/pagination/virtualization for large collections |
| JSON editor | CodeMirror 6 (`@codemirror/lang-json`) | Edit docs with syntax highlight + validation |
| State/fetch | TanStack Query | Caching, loading states for API calls |
| Auth | `iron-session` (cookie) + bcrypt password | Simple login, no external dependency |
| Driver pooling | Single cached `MongoClient` (global singleton) | Reuse one pool across requests |

## 3. Configuration (env vars)
```
MONGODB_URI=mongodb://localhost:27017
ADMIN_USER=admin
ADMIN_PASSWORD=<plaintext; hashed by the app at runtime>
SESSION_SECRET=<random 32+ chars>
READ_ONLY=false          # optional safety mode
```

## 4. MVP feature scope
1. **Login** screen, session cookie, logout, optional read-only mode.
2. **Sidebar**: list databases, expand to list collections (with doc counts).
3. **Collection view**: paginated document table; toggle table/JSON view.
4. **Query bar**: enter a filter (`{ field: "value" }`), sort, projection, limit/skip.
5. **Document CRUD**:
   - View full document (CodeMirror, read-only).
   - Edit document (validates JSON + EJSON types like `ObjectId`, `Date`).
   - Insert new document.
   - Delete document (with confirm).
6. **Collection ops**: create collection, drop collection (with typed confirmation).
7. **Connection status**: show server version, current DB, ping/health.

Explicitly out of MVP (note for later): aggregation builder, indexes, import/export, multi-connection, query history.

## 5. Architecture & routes

```
app/
  login/page.tsx
  (dashboard)/
    layout.tsx                 # sidebar + auth guard
    page.tsx                   # DB/collection overview
    [db]/[collection]/page.tsx # document browser
  api/
    auth/login/route.ts
    auth/logout/route.ts
    databases/route.ts                         # GET list dbs
    databases/[db]/collections/route.ts        # GET/POST/DELETE collections
    databases/[db]/[collection]/docs/route.ts  # GET (find+paginate), POST (insert)
    databases/[db]/[collection]/docs/[id]/route.ts # GET/PUT/DELETE one doc
    health/route.ts
lib/
  mongo.ts        # cached MongoClient singleton
  session.ts      # iron-session config + auth guard helper
  ejson.ts        # safe EJSON parse/serialize (ObjectId, Date, etc.)
  validate.ts     # filter/body validation (zod)
```

Key API rules:
- Every API route checks the session first (401 if missing).
- `READ_ONLY=true` blocks all POST/PUT/DELETE at a shared middleware.
- Use **EJSON** (`mongodb`'s `BSON.EJSON`) end-to-end so `ObjectId`/`Date`/`Decimal128` survive the JSON round-trip to the browser and back.
- Always pass user filters through validation; cap `limit` (e.g. max 200) to protect the server.

## 6. Build phases (incremental, each independently runnable)
1. **Scaffold**: `create-next-app` (TS + Tailwind), add shadcn/ui, set up `lib/mongo.ts`, `/api/health`. Verify connection.
2. **Auth**: login page, iron-session, auth guard on dashboard + API.
3. **Navigation**: list databases + collections in sidebar.
4. **Browse**: document table with server-side pagination + count.
5. **Query**: filter/sort/projection bar wired to `find`.
6. **Read doc**: detail drawer with CodeMirror (read-only) + EJSON.
7. **Mutations**: insert, edit (PUT), delete, with read-only guard + confirms.
8. **Collection ops**: create/drop collection.
9. **Polish**: error toasts, empty states, server version badge, loading skeletons.
10. **Open-source prep**: `README`, `Dockerfile`, `docker-compose.yml` (app + mongo), `.env.example`, MIT/Apache license, GitHub Actions (lint + build), screenshots.

## 7. Distribution (for the open-source launch)
- **Dockerfile** + published image, so users run `docker run -e MONGODB_URI=... -p 3000:3000 mongui`.
- **docker-compose** with a sample mongo for instant demo.
- Clear README with security warning (never expose without auth / on public internet).

## 8. Risks & decisions to keep in mind
- **Large collections**: always paginate + cap limits; use `estimatedDocumentCount` for fast counts.
- **EJSON correctness**: the #1 source of bugs in Mongo UIs. Centralize parse/serialize in `lib/ejson.ts` and test it.
- **Security**: this tool grants full DB access. Auth is mandatory, ship read-only mode, document the risks loudly.
- **Naming/license**: pick the project name and license (MIT is most adoption-friendly for tools) before first public commit.
