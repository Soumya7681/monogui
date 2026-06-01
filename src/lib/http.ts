import { NextResponse } from "next/server";

/**
 * Thrown by validation/EJSON helpers when user input is malformed. The shared
 * error wrappers map this to an HTTP 400 instead of a 500.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Standard error envelope used by every API route:
 *   { status: "error", message: string }
 */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ status: "error", message }, { status });
}

/** Map a caught error to the right response: 400 for validation, else 500. */
export function errorToResponse(err: unknown): NextResponse {
  if (err instanceof ValidationError) return errorResponse(err.message, 400);
  const message = err instanceof Error ? err.message : "Internal server error";
  return errorResponse(message, 500);
}

/** 401 helper - unauthenticated request. */
export function unauthorized(): NextResponse {
  return errorResponse("Unauthorized", 401);
}

/** 403 helper - blocked by read-only mode. */
export function readOnly(): NextResponse {
  return errorResponse("Read-only mode: write operations are disabled", 403);
}

/**
 * Wrap a route handler so any thrown error becomes a 500 with the standard
 * envelope instead of leaking a stack trace. Secrets are never echoed.
 */
export function handleErrors<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorToResponse(err);
    }
  };
}
