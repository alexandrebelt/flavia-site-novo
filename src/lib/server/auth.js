// Password hashing (PBKDF2-SHA256, OWASP-recommended iteration count) built
// on Web Crypto so the same code runs unchanged on Cloudflare Workers and in
// plain Node (used by the seed script).

// Cloudflare Workers' PBKDF2 implementation caps iterations at 100,000
// (Node/browsers would happily do more, but this has to run on Workers).
const ITERATIONS = 100_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

function toBase64(bytes) {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64) {
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveBits(password, salt, iterations) {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations, hash: "SHA-256" },
		keyMaterial,
		HASH_BITS,
	);
	return new Uint8Array(bits);
}

export async function hashPassword(password) {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await deriveBits(password, salt, ITERATIONS);
	return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password, stored) {
	const parts = typeof stored === "string" ? stored.split("$") : [];
	if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
	const iterations = Number(parts[1]);
	const salt = fromBase64(parts[2]);
	const expected = fromBase64(parts[3]);
	const actual = await deriveBits(password, salt, iterations);
	if (actual.length !== expected.length) return false;
	// Constant-time compare so a correct-length-wrong-value guess can't be
	// timed against how many leading bytes matched.
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}

// Runs a real PBKDF2 derivation against a fixed hash when no user matches
// the submitted email, so "unknown e-mail" and "wrong password" take the
// same amount of time and can't be told apart by an attacker probing for
// valid accounts.
const DUMMY_HASH =
	"pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export async function verifyAgainstDummy(password) {
	await verifyPassword(password, DUMMY_HASH);
}

export function validatePasswordStrength(password) {
	const reasons = [];
	if (typeof password !== "string" || password.length < 10) {
		reasons.push("no mínimo 10 caracteres");
	}
	if (!/[a-z]/.test(password || "")) reasons.push("uma letra minúscula");
	if (!/[A-Z]/.test(password || "")) reasons.push("uma letra maiúscula");
	if (!/[0-9]/.test(password || "")) reasons.push("um número");
	if (!/[^A-Za-z0-9]/.test(password || "")) reasons.push("um caractere especial");
	return { valid: reasons.length === 0, reasons };
}
