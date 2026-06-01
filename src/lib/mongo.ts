import { MongoClient, type Db } from "mongodb";

/**
 * Cached MongoClient singleton.
 *
 * Next.js (especially in dev with hot-reload) can re-evaluate modules many
 * times, which would otherwise open a fresh connection pool on every change.
 * We stash the client promise on `globalThis` so a single pool is reused
 * across reloads and across all API routes.
 *
 * Connection is created lazily on first `getClient()` call (not at import) so
 * that `next build` does not require `MONGODB_URI` or attempt a connection.
 */

type MongoGlobal = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as MongoGlobal;

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and set it.",
    );
  }
  return uri;
}

function clientPromise(): Promise<MongoClient> {
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(requireUri(), {
      // Keep the pool small; this is an admin UI, not a high-throughput app.
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    globalWithMongo._mongoClientPromise = client.connect();
  }
  return globalWithMongo._mongoClientPromise;
}

/** Get the connected MongoClient. */
export async function getClient(): Promise<MongoClient> {
  return clientPromise();
}

/**
 * Get a Db handle. Pass a name, or omit to use the database encoded in the
 * connection string (falls back to "admin").
 */
export async function getDb(name?: string): Promise<Db> {
  const client = await getClient();
  return client.db(name);
}
