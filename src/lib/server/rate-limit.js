// Login brute-force protection, backed by the same SESSION KV namespace.
// After `maxAttempts` failures for a given key within the counting window,
// the key is locked out for LOCKOUT_SECONDS. login.ts uses two keys: IP +
// email (MAX_ATTEMPTS, stops a single attacker fast) and the email alone
// (ACCOUNT_MAX_ATTEMPTS, stops a guessing attack spread over many IPs).

const MAX_ATTEMPTS = 5;
export const ACCOUNT_MAX_ATTEMPTS = 20;
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

export async function registerFailedAttempt(kv, key, maxAttempts = MAX_ATTEMPTS) {
	const record = (await kv.get(PREFIX + key, "json")) || { count: 0 };
	record.count += 1;
	let ttl = WINDOW_SECONDS;
	if (record.count >= maxAttempts) {
		record.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
		ttl = LOCKOUT_SECONDS;
	}
	await kv.put(PREFIX + key, JSON.stringify(record), { expirationTtl: ttl });
	return record;
}

export async function clearRateLimit(kv, key) {
	await kv.delete(PREFIX + key);
}

// Inquiry form flood protection: at most INQUIRY_LIMIT submissions per IP
// per INQUIRY_WINDOW_SECONDS. Counts every attempt that reaches the send
// step, so a bot that solves Turnstile still can't mass-submit.
const INQUIRY_LIMIT = 5;
const INQUIRY_WINDOW_SECONDS = 60 * 60;
const INQUIRY_PREFIX = "inquiry:";

export async function consumeInquiryQuota(kv, ip) {
	const key = INQUIRY_PREFIX + ip;
	const count = Number(await kv.get(key)) || 0;
	if (count >= INQUIRY_LIMIT) return false;
	await kv.put(key, String(count + 1), { expirationTtl: INQUIRY_WINDOW_SECONDS });
	return true;
}
