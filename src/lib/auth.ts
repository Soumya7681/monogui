import bcrypt from "bcryptjs";

/**
 * Credential verification.
 *
 * The admin password is supplied as plaintext via `ADMIN_PASSWORD`; the app
 * owns the hashing. On first use we bcrypt-hash the configured password once
 * and cache it on `globalThis` (surviving hot reloads), then every login uses
 * `bcrypt.compare` against that hash. This keeps the bcrypt slow-compare in the
 * login path without asking operators to pre-generate (and escape) a hash.
 */

const SALT_ROUNDS = 10;

type AuthGlobal = typeof globalThis & {
  _monguiAdminHash?: string;
};
const g = globalThis as AuthGlobal;

function adminHash(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD is not set. Add it to .env.local (see .env.example).",
    );
  }
  if (!g._monguiAdminHash) {
    g._monguiAdminHash = bcrypt.hashSync(password, SALT_ROUNDS);
  }
  return g._monguiAdminHash;
}

/**
 * Verify a username + password against the configured admin identity.
 * Runs bcrypt.compare even on a username mismatch to keep timing roughly
 * constant and avoid leaking which field was wrong (FR-AUTH-3).
 */
export async function verifyCredentials(
  user: string,
  password: string,
): Promise<boolean> {
  const adminUser = process.env.ADMIN_USER;
  if (!adminUser) {
    throw new Error(
      "ADMIN_USER is not set. Add it to .env.local (see .env.example).",
    );
  }
  const passwordOk = await bcrypt.compare(password, adminHash());
  return user === adminUser && passwordOk;
}
