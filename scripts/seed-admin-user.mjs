// One-off helper: prints the SQL needed to create (or reset) the single
// admin user. Uses the exact same PBKDF2 implementation as the running
// site (src/lib/server/auth.js), so the hash it produces is verified by
// the real login route.
//
// Usage:
//   node scripts/seed-admin-user.mjs <email> <password> > migrations/seed.sql
//   npx wrangler d1 execute flavia-site-db --local --file=migrations/seed.sql

import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/lib/server/auth.js";

const [, , email, password] = process.argv;

if (!email || !password) {
	console.error("Usage: node scripts/seed-admin-user.mjs <email> <password>");
	process.exit(1);
}

const hash = await hashPassword(password);
const id = randomUUID();
const now = new Date().toISOString();

const sql = `INSERT INTO users (id, email, password_hash, created_at, updated_at)
VALUES ('${id}', '${email.toLowerCase()}', '${hash}', '${now}', '${now}')
ON CONFLICT(email) DO UPDATE SET
  password_hash = excluded.password_hash,
  updated_at = excluded.updated_at;
`;

console.log(sql);
