import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { getSession } from "./lib/server/session.js";

// Single seam for admin auth. Everything under /admin and /api/admin
// requires a valid session, except the login endpoint itself.
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login"]);
const PUBLIC_API_PATHS = new Set(["/api/admin/login"]);

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	const isAdminPage = pathname.startsWith("/admin");
	const isAdminApi = pathname.startsWith("/api/admin");

	if (!isAdminPage && !isAdminApi) {
		return next();
	}

	if (PUBLIC_ADMIN_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
		return next();
	}

	const token = context.cookies.get("admin_session")?.value;
	const session = await getSession(env.SESSION, token);

	if (!session) {
		if (isAdminApi) {
			return new Response(JSON.stringify({ error: "Não autenticado." }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}
		const next = encodeURIComponent(pathname + context.url.search);
		return context.redirect(`/admin/login?next=${next}`);
	}

	context.locals.user = session;
	return next();
});
