/**
 * Security headers added to every response (see middleware.ts).
 *
 * The Content-Security-Policy only allows scripts served as files from this
 * origin (astro.config.mjs keeps Astro from inlining any) plus Cloudflare
 * Turnstile, so even if some text ever slipped through unescaped, an
 * injected <script> or onclick="" would not run. Styles keep
 * 'unsafe-inline' — the admin, GSAP and Turnstile all set inline styles,
 * and styles can't execute code.
 */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	`script-src 'self' ${TURNSTILE_ORIGIN}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"media-src 'self' blob:",
	"font-src 'self' data:",
	"connect-src 'self'",
	`frame-src ${TURNSTILE_ORIGIN}`,
	"worker-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
].join("; ");

export function applySecurityHeaders(response: Response, url: URL, isProduction: boolean): Response {
	const headers = response.headers;
	const isHttps = url.protocol === "https:";

	// Dev runs Vite's inline HMR client, which a strict CSP would block.
	if (isProduction && !headers.has("Content-Security-Policy")) {
		headers.set(
			"Content-Security-Policy",
			isHttps ? `${CONTENT_SECURITY_POLICY}; upgrade-insecure-requests` : CONTENT_SECURITY_POLICY,
		);
	}
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("Cross-Origin-Opener-Policy", "same-origin");
	headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
	);
	if (isHttps) {
		headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	}

	// Admin screens and admin API answers must never be kept by a browser
	// or shared cache (they contain unpublished content and session state).
	if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/")) {
		headers.set("Cache-Control", "no-store");
	}
	return response;
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Blocks cross-site requests to the API (CSRF): any write must come from a
 * page on this same site. Browsers always send Origin on these requests;
 * one that's missing or foreign is refused. (Astro's built-in check only
 * covers HTML form submissions, not the JSON requests the admin makes.)
 */
export function isForeignWrite(request: Request, url: URL): boolean {
	if (!url.pathname.startsWith("/api/") || !STATE_CHANGING_METHODS.has(request.method)) {
		return false;
	}
	const origin = request.headers.get("Origin");
	return origin !== url.origin;
}
