// Cloudflare Turnstile (invisible anti-bot check) for the public inquiry
// form. Keys come from the Turnstile widget created in the Cloudflare
// dashboard: TURNSTILE_SITE_KEY (public, rendered into the page) and
// TURNSTILE_SECRET_KEY (Worker secret, used only here).
//
// Until they're configured, Cloudflare's official always-pass test pair is
// used, so the form keeps working in dev and before setup — with no bot
// protection from Turnstile itself (the honeypot and rate limit still apply).

const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(env) {
	return env.TURNSTILE_SITE_KEY || TEST_SITE_KEY;
}

export async function verifyTurnstile(env, token, ip) {
	if (!token) return false;

	let secret = env.TURNSTILE_SECRET_KEY;
	if (!secret) {
		if (env.TURNSTILE_SITE_KEY) {
			// A real site key without its secret can't be verified; failing
			// closed here would silently drop every real lead instead.
			console.error("TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing — skipping verification.");
			return true;
		}
		secret = TEST_SECRET_KEY;
	}

	const body = new FormData();
	body.append("secret", secret);
	body.append("response", token);
	if (ip) body.append("remoteip", ip);

	try {
		const res = await fetch(VERIFY_URL, { method: "POST", body });
		const outcome = await res.json();
		return outcome.success === true;
	} catch (err) {
		console.error("Turnstile verification request failed:", err);
		return false;
	}
}
