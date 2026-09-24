// Login brute-force protection, backed by the same SESSION KV namespace.
// After MAX_ATTEMPTS failures for a given key (IP + email) within the
// counting window, the key is locked out for LOCKOUT_SECONDS.

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;
const LOCKOUT_SECONDS = 15 * 60;
const PREFIX = "loginfail:";

export async function checkRateLimit(kv, key) {
	const record = await kv.get(PREFIX + key, "json");
	if (record?.lockedUntil && record.lockedUntil > Date.now()) {
		return { blocked: true, retryAfterSeconds: Math.ceil((record.lockedUntil - Date.now()) / 1000) };
	}
	return { blocked: false };
}

export async function registerFailedAttempt(kv, key) {
	const record = (await kv.get(PREFIX + key, "json")) || { count: 0 };
	record.count += 1;
	let ttl = WINDOW_SECONDS;
	if (record.count >= MAX_ATTEMPTS) {
		record.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
		ttl = LOCKOUT_SECONDS;
	}
	await kv.put(PREFIX + key, JSON.stringify(record), { expirationTtl: ttl });
	return record;
}

export async function clearRateLimit(kv, key) {
	await kv.delete(PREFIX + key);
}
