import { NextResponse, type NextRequest } from "next/server";
import type { Document, Filter } from "mongodb";
import { getClient } from "@/lib/mongo";
import { withAuth, readOnlyGuard } from "@/lib/session";
import { errorResponse } from "@/lib/http";
import { assertValidName } from "@/lib/validate";
import { parseId, parseObject, serialize } from "@/lib/ejson";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ db: string; collection: string; id: string }> };

async function getColl(ctx: Ctx) {
  const { db: dbName, collection: collName, id } = await ctx.params;
  assertValidName("database", dbName);
  assertValidName("collection", collName);
  const coll = (await getClient()).db(dbName).collection(collName);
  // _id can be any BSON type; build the filter explicitly to satisfy the driver.
  const filter = { _id: parseId(id) } as Filter<Document>;
  return { coll, filter };
}

/** GET - one document by _id (FR-READ-1). */
export const GET = withAuth<Ctx>(async (_req, _session, ctx) => {
  const { coll, filter } = await getColl(ctx);
  const doc = await coll.findOne(filter);
  if (!doc) return errorResponse("Document not found", 404);
  return NextResponse.json({ status: "ok", doc: serialize(doc) });
});

/** PUT - replace a document, preserving its _id (FR-WRITE-2). */
export const PUT = withAuth<Ctx>(async (req: NextRequest, _session, ctx) => {
  const ro = readOnlyGuard();
  if (ro) return ro;

  const { coll, filter } = await getColl(ctx);
  const text = await req.text();
  const replacement = parseObject(text);
  // _id is immutable in MongoDB; drop any incoming _id and key off the path id.
  delete replacement._id;

  const result = await coll.replaceOne(filter, replacement);
  if (result.matchedCount === 0) {
    return errorResponse("Document not found", 404);
  }
  return NextResponse.json({ status: "ok", modifiedCount: result.modifiedCount });
});

/** DELETE - delete a document by _id (FR-WRITE-3). */
export const DELETE = withAuth<Ctx>(async (_req, _session, ctx) => {
  const ro = readOnlyGuard();
  if (ro) return ro;

  const { coll, filter } = await getColl(ctx);
  const result = await coll.deleteOne(filter);
  if (result.deletedCount === 0) {
    return errorResponse("Document not found", 404);
  }
  return NextResponse.json({ status: "ok" });
});
