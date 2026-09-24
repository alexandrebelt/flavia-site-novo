import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getUserByEmail } from "../../../lib/server/users-store.js";
import { verifyPassword, verifyAgainstDummy } from "../../../lib/server/auth.js";
import { createSession } from "../../../lib/server/session.js";
import {
	ACCOUNT_MAX_ATTEMPTS,
	checkRateLimit,
	clearRateLimit,
	registerFailedAttempt,
} from "../../../lib/server/rate-limit.js";

export const prerender = false;

const GENERIC_ERROR = "E-mail ou senha inválidos.";

export const POST: APIRoute = async ({ request, cookies }) => {
	let body: { email?: string; password?: string };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: GENERIC_ERROR }, { status: 400 });
	}

	const email = (body.email || "").trim().toLowerCase();
	const password = body.password || "";
	const ip = request.headers.get("cf-connecting-ip") || "unknown";
	const rateLimitKey = `${ip}:${email}`;
	const accountLimitKey = `account:${email}`;

	const ipLimit = await checkRateLimit(env.SESSION, rateLimitKey);
	const rateLimit = ipLimit.blocked ? ipLimit : await checkRateLimit(env.SESSION, accountLimitKey);
	if (rateLimit.blocked) {
		return Response.json(
			{ error: "Muitas tentativas de login. Tente novamente em alguns minutos." },
			{ status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
		);
	}

	if (!email || !password) {
		return Response.json({ error: GENERIC_ERROR }, { status: 400 });
	}

	const user = await getUserByEmail(env.DB, email);
	if (!user) {
		// Keeps response time consistent with the "user found, wrong
		// password" path so a stranger can't use timing to enumerate emails.
		await verifyAgainstDummy(password);
		await registerFailedAttempt(env.SESSION, rateLimitKey);
		await registerFailedAttempt(env.SESSION, accountLimitKey, ACCOUNT_MAX_ATTEMPTS);
		return Response.json({ error: GENERIC_ERROR }, { status: 401 });
	}

	const isValid = await verifyPassword(password, user.password_hash as string);
	if (!isValid) {
		await registerFailedAttempt(env.SESSION, rateLimitKey);
		await registerFailedAttempt(env.SESSION, accountLimitKey, ACCOUNT_MAX_ATTEMPTS);
		return Response.json({ error: GENERIC_ERROR }, { status: 401 });
	}

	await clearRateLimit(env.SESSION, rateLimitKey);
	await clearRateLimit(env.SESSION, accountLimitKey);
	const { token, ttl } = await createSession(env.SESSION, user as { id: string; email: string });

	cookies.set("admin_session", token, {
		httpOnly: true,
		secure: new URL(request.url).protocol === "https:",
		sameSite: "lax",
		path: "/",
		maxAge: ttl,
	});

	return Response.json({ ok: true });
};
