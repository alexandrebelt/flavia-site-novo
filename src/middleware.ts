import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { getSession } from "./lib/server/session.js";
import { loadOrderedProjects, loadSiteSettings } from "./lib/server/site-data";
import { applySecurityHeaders, isForeignWrite } from "./lib/server/security-headers";

function memo<T>(load: () => Promise<T>): () => Promise<T> {
	let pending: Promise<T> | undefined;
	return () => (pending ??= load());
}

// Single seam for admin auth. Everything under /admin and /api/admin
// requires a valid session, except the login endpoint itself.
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login"]);
const PUBLIC_API_PATHS = new Set(["/api/admin/login"]);

export const onRequest = defineMiddleware(async (context, next) => {
	const { url, request } = context;

	if (isForeignWrite(request, url)) {
		return finish(Response.json({ error: "Forbidden." }, { status: 403 }), url);
	}

	// Lazy, and at most one D1 read each per request, however many
	// components (Layout, Header, Footer, a page) ask for them.
	const siteSettings = memo(() => loadSiteSettings(env.DB));
	context.locals.siteSettings = siteSettings;
	context.locals.projects = memo(async () => loadOrderedProjects(env.DB, await siteSettings()));

	const { pathname } = url;
	const isAdminPage = pathname.startsWith("/admin");
	const isAdminApi = pathname.startsWith("/api/admin");

	if (!isAdminPage && !isAdminApi) {
		return finish(await next(), url);
	}

	if (PUBLIC_ADMIN_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
		return finish(await next(), url);
	}

	const token = context.cookies.get("admin_session")?.value;
	const session = await getSession(env.SESSION, token);

	if (!session) {
		if (isAdminApi) {
			return finish(Response.json({ error: "Não autenticado." }, { status: 401 }), url);
		}
		const nextPath = encodeURIComponent(pathname + url.search);
		return finish(context.redirect(`/admin/login?next=${nextPath}`), url);
	}

	context.locals.user = session;
	return finish(await next(), url);
});

function finish(response: Response, url: URL): Response {
	try {
		return applySecurityHeaders(response, url, import.meta.env.PROD);
	} catch {
		// Some responses (e.g. a proxied fetch) come with immutable headers.
		return applySecurityHeaders(new Response(response.body, response), url, import.meta.env.PROD);
	}
}
