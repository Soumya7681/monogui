import { NextResponse, type NextRequest } from "next/server";
import { getClient } from "@/lib/mongo";
import { withAuth, readOnlyGuard } from "@/lib/session";
import { errorResponse } from "@/lib/http";
import { assertValidName, parseCreateCollection } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ db: string }> };

/** GET - list collections with estimated document counts (FR-NAV-2). */
export const GET = withAuth<Ctx>(async (_req, _session, ctx) => {
  const { db: dbName } = await ctx.params;
  assertValidName("database", dbName);

  const db = (await getClient()).db(dbName);
  const cols = await db.listCollections().toArray();

  const collections = await Promise.all(
    cols.map(async (c) => {
      let count: number | null = null;
      if (c.type !== "view") {
        try {
          count = await db.collection(c.name).estimatedDocumentCount();
        } catch {
          count = null;
        }
      }
      return { name: c.name, type: c.type ?? "collection", count };
    }),
  );

  collections.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ status: "ok", collections });
});

/** POST - create a collection by name (FR-COLL-1). */
export const POST = withAuth<Ctx>(async (req, _session, ctx) => {
  const ro = readOnlyGuard();
  if (ro) return ro;

  const { db: dbName } = await ctx.params;
  assertValidName("database", dbName);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }
  const { name } = parseCreateCollection(body);

  const db = (await getClient()).db(dbName);
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length > 0) {
    return errorResponse(`Collection "${name}" already exists`, 409);
  }

  await db.createCollection(name);
  return NextResponse.json({ status: "ok", name }, { status: 201 });
});

/** DELETE /api/databases/{db}/collections?name={name} - drop a collection (FR-COLL-2). */
export const DELETE = withAuth<Ctx>(async (req: NextRequest, _session, ctx) => {
  const ro = readOnlyGuard();
  if (ro) return ro;

  const { db: dbName } = await ctx.params;
  assertValidName("database", dbName);

  const name = req.nextUrl.searchParams.get("name") ?? "";
  assertValidName("collection", name);

  const db = (await getClient()).db(dbName);
  // The driver reports success even for a missing namespace, so check first.
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    return errorResponse(`Collection "${name}" not found`, 404);
  }

  await db.dropCollection(name);
  return NextResponse.json({ status: "ok", name });
});
