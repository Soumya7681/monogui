import { BSON, ObjectId } from "mongodb";
import { ValidationError } from "@/lib/http";

const { EJSON } = BSON;

/**
 * Centralized Extended JSON (relaxed) helpers. All BSON <-> JSON conversion in
 * the app MUST go through this module (NFR-DATA-1). Relaxed mode keeps
 * ObjectId/Date/Decimal128 intact while staying human-readable in the editor.
 */

/** Convert a BSON value (document, array, scalar) into a plain EJSON object. */
export function serialize<T = unknown>(value: T): unknown {
  return EJSON.serialize(value as object, { relaxed: true });
}

/** Convert an array of BSON documents into plain EJSON objects. */
export function serializeMany<T = unknown>(values: T[]): unknown[] {
  return values.map((v) => serialize(v));
}

/** Parse an EJSON string back into BSON-typed values. Throws on malformed input. */
export function parse(text: string): unknown {
  try {
    return EJSON.parse(text, { relaxed: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    throw new ValidationError(`Invalid Extended JSON: ${detail}`);
  }
}

/** Parse an EJSON string and require the result to be a (non-array) object. */
export function parseObject(text: string): Record<string, unknown> {
  const value = parse(text);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Expected a JSON object (e.g. { \"field\": \"value\" }).");
  }
  return value as Record<string, unknown>;
}

/**
 * Parse an `_id` taken from a URL path segment. Accepts an EJSON-encoded id
 * (e.g. `{"$oid":"..."}`), a bare 24-char hex ObjectId, or a plain string.
 */
export function parseId(raw: string): unknown {
  const decoded = decodeURIComponent(raw);
  // Try EJSON first ({"$oid":...}, {"$numberLong":...}, etc.)
  try {
    return EJSON.parse(decoded, { relaxed: true });
  } catch {
    // fall through
  }
  if (ObjectId.isValid(decoded) && /^[0-9a-fA-F]{24}$/.test(decoded)) {
    return new ObjectId(decoded);
  }
  return decoded;
}

/** Encode an _id value for use in a URL path segment. */
export function encodeId(id: unknown): string {
  return encodeURIComponent(EJSON.stringify(id, { relaxed: true }));
}
