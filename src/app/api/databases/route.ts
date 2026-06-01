import { NextResponse } from "next/server";
import { getClient } from "@/lib/mongo";
import { withAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/databases - list all databases visible to the connection (FR-NAV-1). */
export const GET = withAuth(async () => {
  const client = await getClient();
  const { databases } = await client.db().admin().listDatabases();

  return NextResponse.json({
    status: "ok",
    databases: databases.map((d) => ({
      name: d.name,
      sizeOnDisk: typeof d.sizeOnDisk === "number" ? d.sizeOnDisk : null,
      empty: Boolean(d.empty),
    })),
  });
});
