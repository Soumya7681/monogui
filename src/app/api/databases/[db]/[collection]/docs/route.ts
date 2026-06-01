import { NextResponse, type NextRequest } from "next/server";
import type { Document, Filter, Sort } from "mongodb";
import { getClient } from "@/lib/mongo";
import { withAuth, readOnlyGuard } from "@/lib/session";
import { assertValidName, parseListParams } from "@/lib/validate";
import { parseObject, serialize, serializeMany } from "@/lib/ejson";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ db: string; collection: string }> };

/** GET - paginated find with filter/sort/projection (FR-BROWSE-1..5, FR-QUERY-*). */
export const GET = withAuth<Ctx>(async (req: NextRequest, _session, ctx) => {
  const { db: dbName, collection: collName } = await ctx.params;
  assertValidName("database", dbName);
  assertValidName("collection", collName);

  const { filter, sort, projection, limit, skip } = parseListParams(
    req.nextUrl.searchParams,
  );

  const coll = (await getClient()).db(dbName).collection(collName);

  let cursor = coll.find(filter as Filter<Document>).skip(skip).limit(limit);
  if (sort) cursor = cursor.sort(sort as Sort);
  if (projection) cursor = cursor.project(projection as Document);
  const docs = await cursor.toArray();

  // NFR-PERF-2: estimatedDocumentCount for unfiltered counts; countDocuments
  // only when a filter narrows the result set.
  const hasFilter = Object.keys(filter).length > 0;
  const total = hasFilter
    ? await coll.countDocuments(filter)
    : await coll.estimatedDocumentCount();

  return NextResponse.json({
    status: "ok",
    docs: serializeMany(docs),
    total,
    limit,
    skip,
    filtered: hasFilter,
  });
});

/** POST - insert a document parsed from EJSON (FR-WRITE-1). */
export const POST = withAuth<Ctx>(async (req: NextRequest, _session, ctx) => {
  const ro = readOnlyGuard();
  if (ro) return ro;

  const { db: dbName, collection: collName } = await ctx.params;
  assertValidName("database", dbName);
  assertValidName("collection", collName);

  const text = await req.text();
  const doc = parseObject(text);

  const coll = (await getClient()).db(dbName).collection(collName);
  const result = await coll.insertOne(doc);

  return NextResponse.json(
    { status: "ok", insertedId: serialize(result.insertedId) },
    { status: 201 },
  );
});
