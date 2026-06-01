import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { verifyCredentials } from "@/lib/auth";
import { errorResponse, handleErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Verifies ADMIN_USER + password and establishes the session cookie.
 * Invalid credentials return 401 without revealing which field was wrong.
 */
export const POST = handleErrors(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const { user, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof user !== "string" || typeof password !== "string") {
    return errorResponse("Username and password are required", 400);
  }

  if (!(await verifyCredentials(user, password))) {
    return errorResponse("Invalid username or password", 401);
  }

  const session = await getSession();
  session.user = user;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ status: "ok", user });
});
