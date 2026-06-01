# Mongui - Requirements

Detailed functional and non-functional requirements for the MVP, derived from `PLAN.md`. Requirement IDs are stable; reference them in commits and issues.

---

## 1. Product summary

Mongui is a single, self-hosted Next.js application that lets an authenticated operator browse and edit one MongoDB instance through the browser. It targets the gap left by the deprecated, unmaintained mongo-express. The MVP covers connect, navigate, browse, query, and full document CRUD plus basic collection operations.

### 1.1 Personas
- **Operator / developer**: self-hosts Mongui next to their database to inspect and fix data during development or light ops.
- **Maintainer**: the open-source author extending the tool.

### 1.2 Non-goals (MVP)
Aggregation pipeline builder, index management, import/export, multi-connection manager, user/role administration, query history, and an interactive shell are all out of scope for the MVP. They are candidates for later releases.

---

## 2. Configuration requirements

| ID | Requirement |
|----|-------------|
| CFG-1 | The app reads all configuration from environment variables. `.env.example` documents every variable; `.env.local` holds local values and is gitignored. |
| CFG-2 | `MONGODB_URI` (required) defines the single MongoDB connection. Absence is a fatal startup error with a clear message. |
| CFG-3 | `ADMIN_USER` and `ADMIN_PASSWORD` (plaintext) define the single login identity. The app bcrypt-hashes `ADMIN_PASSWORD` at runtime (cached) so operators never supply a precomputed hash. |
| CFG-4 | `SESSION_SECRET` (32+ chars) encrypts the session cookie. Absence is a fatal error once auth ships. |
| CFG-5 | `READ_ONLY` (default `false`) when `true` disables all write operations app-wide. |

---

## 3. Functional requirements

### 3.1 Connection & health
| ID | Requirement | Phase |
|----|-------------|-------|
| FR-CONN-1 | The app maintains a single cached `MongoClient` connection pool reused across all requests and hot reloads. | 1 (done) |
| FR-CONN-2 | `GET /api/health` returns connection status, ping result, and MongoDB server version. | 1 (done) |
| FR-CONN-3 | When MongoDB is unreachable, `/api/health` returns HTTP 503 with `{ status: "error", message }`. | 1 (done) |
| FR-CONN-4 | The dashboard displays a connection-status indicator and the server version. | 9 |

### 3.2 Authentication
| ID | Requirement | Phase |
|----|-------------|-------|
| FR-AUTH-1 | An unauthenticated user visiting any dashboard route is redirected to `/login`. | 2 |
| FR-AUTH-2 | `POST /api/auth/login` verifies `ADMIN_USER` + password against `ADMIN_PASSWORD` (bcrypt-hashed at runtime, then `bcrypt.compare`) and establishes an encrypted `iron-session` cookie on success. | 2 |
| FR-AUTH-3 | Invalid credentials return HTTP 401 without revealing which field was wrong. | 2 |
| FR-AUTH-4 | `POST /api/auth/logout` destroys the session and redirects to `/login`. | 2 |
| FR-AUTH-5 | Every API route except `auth/login` rejects unauthenticated requests with HTTP 401. | 2 |
| FR-AUTH-6 | The session cookie is `httpOnly`, `sameSite=lax`, and `secure` in production. | 2 |

### 3.3 Navigation
| ID | Requirement | Phase |
|----|-------------|-------|
| FR-NAV-1 | `GET /api/databases` lists all databases the connection can see. | 3 |
| FR-NAV-2 | `GET /api/databases/{db}/collections` lists collections in a database, each with an (estimated) document count. | 3 |
| FR-NAV-3 | A sidebar shows databases; expanding one lists its collections and links to the document browser. | 3 |
| FR-NAV-4 | Selecting a collection navigates to `/{db}/{collection}`. | 3 |

### 3.4 Browse documents
| ID | Requirement | Phase |
|----|-------------|-------|
| FR-BROWSE-1 | `GET /api/databases/{db}/{collection}/docs` returns a page of documents with server-side pagination (`limit`, `skip`). | 4 |
| FR-BROWSE-2 | `limit` is capped at 200; requests above the cap are clamped. | 4 |
| FR-BROWSE-3 | The response includes a total/estimated count for pagination UI (`estimatedDocumentCount`, or `countDocuments` when a filter is applied). | 4 |
| FR-BROWSE-4 | Documents render in a table view (TanStack Table) and a raw JSON view; the user can toggle between them. | 4 |
| FR-BROWSE-5 | All document payloads are serialized as Extended JSON so BSON types survive transport. | 4 |

### 3.5 Query
| ID | Requirement | Phase |
|----|-------------|-------|
| FR-QUERY-1 | A query bar accepts a MongoDB filter as EJSON (e.g. `{ "status": "active" }`). | 5 |
| FR-QUERY-2 | The query bar accepts optional sort and projection specs. | 5 |
| FR-QUERY-3 | Filters are validated server-side; malformed input returns HTTP 400 with a helpful message and never reaches the driver unparsed. | 5 |
| FR-QUERY-4 | Pagination, sort, and projection compose with the filter on the same endpoint. | 5 |

### 3.6 Read a document
| ID | Requirement | Phase |
|----|-------------|-------|
| FR-READ-1 | `GET /api/databases/{db}/{collection}/docs/{id}` returns one document by `_id` (EJSON-encoded id). | 6 |
| FR-READ-2 | A detail view shows the full document in a CodeMirror JSON editor (read-only by default) with syntax highlighting. | 6 |

### 3.7 Mutations (write operations)
| ID | Requirement | Phase |
|----|-------------|-------|
| FR-WRITE-1 | `POST .../docs` inserts a new document parsed from EJSON. | 7 |
| FR-WRITE-2 | `PUT .../docs/{id}` replaces/updates an existing document parsed from EJSON, preserving `_id`. | 7 |
| FR-WRITE-3 | `DELETE .../docs/{id}` deletes a document after explicit user confirmation in the UI. | 7 |
| FR-WRITE-4 | When `READ_ONLY=true`, all of FR-WRITE-1..3 return HTTP 403 before any DB call. | 7 |
| FR-WRITE-5 | Invalid EJSON in any write body returns HTTP 400 with a clear parse error. | 7 |

### 3.8 Collection operations
| ID | Requirement | Phase |
|----|-------------|-------|
| FR-COLL-1 | `POST /api/databases/{db}/collections` creates a collection by name. | 8 |
| FR-COLL-2 | `DELETE /api/databases/{db}/collections` (or `/{collection}`) drops a collection only after the user types the collection name to confirm. | 8 |
| FR-COLL-3 | Collection ops respect `READ_ONLY` (403 when enabled). | 8 |

---

## 4. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-SEC-1 | Mongui grants full read/write access to the configured database. Auth is mandatory; the app must never serve data without a valid session. |
| NFR-SEC-2 | The README must warn operators never to expose Mongui on the public internet without auth and ideally a network boundary. |
| NFR-SEC-3 | Read-only mode (`READ_ONLY=true`) provides a safe browse-only deployment. |
| NFR-SEC-4 | Secrets (URI, admin password, session secret) are never logged or returned in any API response. |
| NFR-PERF-1 | Large collections must never be loaded in full. All listing endpoints paginate and cap `limit` at 200. |
| NFR-PERF-2 | Use `estimatedDocumentCount` for unfiltered counts to avoid full scans; use `countDocuments` only when a filter is present. |
| NFR-PERF-3 | A single connection pool (max size 10) is shared process-wide; no per-request connections. |
| NFR-REL-1 | Server selection times out at 5s so an unreachable DB fails fast with a clear error rather than hanging. |
| NFR-DATA-1 | All BSON <-> JSON conversion goes through `src/lib/ejson.ts`. Plain `JSON.stringify`/`JSON.parse` on documents is prohibited. |
| NFR-CODE-1 | TypeScript strict mode; no `any` in committed code. |
| NFR-CODE-2 | Each build phase leaves the app runnable and `npm run build` + `npm run lint` clean. |

---

## 5. Distribution requirements (open-source launch, Phase 10)

| ID | Requirement |
|----|-------------|
| DIST-1 | A `Dockerfile` produces a runnable image; `docker run -e MONGODB_URI=... -p 3000:3000 mongui` starts the app. |
| DIST-2 | A `docker-compose.yml` brings up Mongui plus a sample MongoDB for an instant demo. |
| DIST-3 | `.env.example` documents every variable with generation hints for hashes/secrets. |
| DIST-4 | A `README.md` covers quick start, configuration, screenshots, and the security warning. |
| DIST-5 | An OSI license (MIT recommended) is committed before the first public push. |
| DIST-6 | CI (GitHub Actions) runs lint + build on every push/PR. |

---

## 6. Acceptance criteria (MVP "done")

The MVP is complete when an operator can:
1. Start the app with only `MONGODB_URI` + credentials set, and log in.
2. See all databases and collections in the sidebar with counts.
3. Open a collection, page through documents, and run a filter/sort/projection query.
4. View, insert, edit, and delete individual documents with BSON types intact.
5. Create and drop a collection (with confirmation).
6. Run the whole stack in read-only mode and have every write blocked.
7. Build and run the production image via Docker.
