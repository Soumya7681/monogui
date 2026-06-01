import { NextResponse } from "next/server";
import { getClient } from "@/lib/mongo";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Pings the MongoDB server and returns connection status + server version.
 */
export async function GET() {
  try {
    const client = await getClient();
    const admin = client.db().admin();

    const ping = await admin.ping();
    const info = await admin.serverInfo();

    return NextResponse.json({
      status: "ok",
      ping: ping.ok === 1,
      serverVersion: info.version,
      readOnly: process.env.READ_ONLY === "true",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { status: "error", message },
      { status: 503 },
    );
  }
}
