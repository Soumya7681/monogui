import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { handleErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 * Destroys the session. The client redirects to /login afterwards.
 */
export const POST = handleErrors(async () => {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ status: "ok" });
});
