import type { APIRoute } from "astro";
import { siteOrigin } from "../lib/server/site-data";

// Follows the admin's "Permitir que buscadores indexem o site" switch.
export const GET: APIRoute = async ({ locals, url }) => {
	const settings = await locals.siteSettings();
	const origin = siteOrigin(settings, url);
	const allowIndexing = settings.seo.allowIndexing !== false;

	const body = allowIndexing
		? [
				"User-agent: *",
				"Allow: /",
				"Disallow: /admin",
				"Disallow: /api/",
				"Disallow: /partials/",
				"",
				`Sitemap: ${origin}/sitemap.xml`,
			]
		: ["User-agent: *", "Disallow: /"];

	return new Response(`${body.join("\n")}\n`, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
