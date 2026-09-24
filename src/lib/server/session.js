// Admin sessions live in the SESSION KV namespace, keyed by a random
// bearer token stored in an httpOnly cookie. There's only ever one admin
// user, so on password change we just wipe every outstanding session
// instead of tracking per-user session versions.

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_PREFIX = "session:";

function generateToken() {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export async function createSession(kv, user) {
	const token = generateToken();
	await kv.put(
		SESSION_PREFIX + token,
		JSON.stringify({ userId: user.id, email: user.email, createdAt: new Date().toISOString() }),
		{ expirationTtl: SESSION_TTL_SECONDS },
	);
	return { token, ttl: SESSION_TTL_SECONDS };
}

export async function getSession(kv, token) {
	if (!token) return null;
	return kv.get(SESSION_PREFIX + token, "json");
}

export async function deleteSession(kv, token) {
	if (!token) return;
	await kv.delete(SESSION_PREFIX + token);
}

export async function deleteAllSessions(kv) {
	const list = await kv.list({ prefix: SESSION_PREFIX });
	await Promise.all(list.keys.map((k) => kv.delete(k.name)));
}
