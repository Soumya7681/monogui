import { z } from "zod";
import { ValidationError } from "@/lib/http";
import { parseObject } from "@/lib/ejson";

export const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export interface ListParams {
  filter: Record<string, unknown>;
  sort?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  limit: number;
  skip: number;
}

const numeric = z.coerce.number().int().nonnegative();

/**
 * Parse + validate the query string for a document-listing request.
 * Filters/sort/projection arrive as EJSON strings; `limit` is capped at 200
 * and `skip` is clamped to >= 0 (FR-BROWSE-2, FR-QUERY-3, NFR-PERF-1).
 */
export function parseListParams(searchParams: URLSearchParams): ListParams {
  const filterRaw = searchParams.get("filter");
  const sortRaw = searchParams.get("sort");
  const projectionRaw = searchParams.get("projection");

  const filter = filterRaw && filterRaw.trim() ? parseObject(filterRaw) : {};
  const sort = sortRaw && sortRaw.trim() ? parseObject(sortRaw) : undefined;
  const projection =
    projectionRaw && projectionRaw.trim() ? parseObject(projectionRaw) : undefined;

  const limitParsed = numeric.safeParse(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const skipParsed = numeric.safeParse(searchParams.get("skip") ?? 0);
  if (!limitParsed.success) throw new ValidationError("`limit` must be a non-negative integer");
  if (!skipParsed.success) throw new ValidationError("`skip` must be a non-negative integer");

  const limit = Math.min(Math.max(limitParsed.data, 1), MAX_LIMIT);

  return { filter, sort, projection, limit, skip: skipParsed.data };
}

/** Reject obviously invalid database/collection names early. */
export function assertValidName(kind: "database" | "collection", name: string): void {
  if (!name || !name.trim()) {
    throw new ValidationError(`${kind} name is required`);
  }
  if (name.length > 120) {
    throw new ValidationError(`${kind} name is too long`);
  }
  if (name.startsWith("$") || name.includes("\0")) {
    throw new ValidationError(`Invalid ${kind} name`);
  }
}

const createCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required").max(120),
});

/** Validate the body of POST /collections. */
export function parseCreateCollection(body: unknown): { name: string } {
  const result = createCollectionSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "Invalid request body");
  }
  assertValidName("collection", result.data.name);
  return result.data;
}
