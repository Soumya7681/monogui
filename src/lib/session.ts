import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { errorToResponse, readOnly, unauthorized } from "@/lib/http";

export interface SessionData {
  user?: string;
  isLoggedIn?: boolean;
}

function sessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // CFG-4: absence (or weakness) of the session secret is a fatal error
    // once auth ships. Fail loudly rather than encrypting with a weak key.
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return secret;
}

export function sessionOptions(): SessionOptions {
  return {
    cookieName: "mongui_session",
    password: sessionPassword(),
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

/** Read (or create) the iron-session bound to the current request cookies. */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

type RouteHandler<Ctx> = (
  req: NextRequest,
  session: IronSession<SessionData>,
  ctx: Ctx,
) => Promise<NextResponse>;

/**
 * Shared API guard (FR-AUTH-5). Wraps a route handler so that:
 *  - unauthenticated requests get a 401 before any DB access, and
 *  - thrown errors become a standard 500 envelope instead of a stack trace.
 *
 * Every route under `src/app/api/` except `auth/login` must use this.
 */
export function withAuth<Ctx>(handler: RouteHandler<Ctx>) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    try {
      const session = await getSession();
      if (!session.isLoggedIn) return unauthorized();
      return await handler(req, session, ctx);
    } catch (err) {
      return errorToResponse(err);
    }
  };
}

/**
 * Single enforcement point for READ_ONLY mode (rule 5 / FR-WRITE-4).
 * Call at the top of every write handler; returns a 403 response to return
 * early, or `null` when writes are allowed.
 */
export function readOnlyGuard(): NextResponse | null {
  return process.env.READ_ONLY === "true" ? readOnly() : null;
}
