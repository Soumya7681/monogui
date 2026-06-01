# Mongui

A lightweight, self-hosted web UI for browsing and editing MongoDB — a maintained
replacement for the deprecated [mongo-express](https://github.com/mongo-express/mongo-express).

Connect one MongoDB instance via a single `MONGODB_URI`, log in, and browse
databases, run queries, and perform full document CRUD from your browser.

- Single cached connection pool (the official `mongodb` driver)
- Cookie session auth (`iron-session` + bcrypt), with an optional read-only mode
- Extended JSON end to end, so `ObjectId`, `Date`, and `Decimal128` round-trip safely
- Paginated, capped queries (filter / sort / projection) that never load a collection in full

> [!WARNING]
> Mongui grants full read/write access to the configured database. **Never expose
> it on the public internet without authentication, and ideally keep it behind a
> network boundary (VPN / private network).** Use `READ_ONLY=true` for a safe,
> browse-only deployment.

## Quick start (Docker Compose)

Brings up Mongui plus a sample MongoDB:

```bash
docker compose up --build
# open http://localhost:3000  (login: admin / change-me)
```

Change `ADMIN_PASSWORD` and `SESSION_SECRET` in `docker-compose.yml` before any real use.

## Quick start (local dev)

Requires Node.js 20.9+ and a reachable MongoDB.

```bash
npm install
cp .env.example .env.local   # then edit the values
npm run dev                  # http://localhost:3000
```

## Run the production image

```bash
docker build -t mongui .
docker run -p 3000:3000 \
  -e MONGODB_URI="mongodb://user:pass@host:27017/?authSource=admin" \
  -e ADMIN_USER=admin \
  -e ADMIN_PASSWORD="a-strong-password" \
  -e SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  mongui
```

## Configuration

All configuration comes from environment variables (see `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | yes | Connection string for the single MongoDB instance. Include credentials + `authSource` if the server has auth enabled. |
| `ADMIN_USER` | yes | Login username. |
| `ADMIN_PASSWORD` | yes | Login password in **plaintext** — Mongui bcrypt-hashes it at runtime, so you never generate or escape a hash yourself. |
| `SESSION_SECRET` | yes | 32+ character secret used to encrypt the session cookie. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `READ_ONLY` | no | When `true`, all write operations (insert/update/delete/drop) return 403. Defaults to `false`. |

Secrets are kept in `.env.local` (gitignored); `.env.example` documents every variable.

## Scripts

```bash
npm run dev      # dev server (Turbopack) on :3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · the official `mongodb` driver ·
Tailwind CSS 4 · TanStack Query & Table · CodeMirror 6 · iron-session · zod.

## License

[MIT](./LICENSE)
