import { defineMiddleware } from "astro:middleware";

/**
 * Single seam for admin auth. Right now every request to /admin is let
 * through with no password. When real auth is added (sessions, hashed
 * password, etc.), plug the check into `isAdminAuthenticated` and redirect
 * unauthenticated requests to a login page here — nothing in the admin pages
 * or API routes needs to change.
 */
function isAdminAuthenticated(_context: Parameters<Parameters<typeof defineMiddleware>[0]>[0]) {
	return true;
}

export const onRequest = defineMiddleware((context, next) => {
	if (context.url.pathname.startsWith("/admin") || context.url.pathname.startsWith("/api/admin")) {
		if (!isAdminAuthenticated(context)) {
			return context.redirect("/admin/login");
		}
	}
	return next();
});
