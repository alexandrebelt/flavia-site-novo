import type { APIRoute } from "astro";
import { PUBLIC_PAGES, siteOrigin } from "../lib/server/site-data";

function escapeXml(value: string): string {
	return value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

// The fixed pages plus every project in D1 — a project created in the admin
// is listed here on the next request.
export const GET: APIRoute = async ({ locals, url }) => {
	const settings = await locals.siteSettings();
	const origin = siteOrigin(settings, url);
	const projects = await locals.projects();

	const paths = [
		...PUBLIC_PAGES.map((page) => page.path),
		...projects.map((project) => `/portfolio/${project.slug}`),
	];

	const urls = paths
		.map((path) => `\t<url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`)
		.join("\n");

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{ headers: { "Content-Type": "application/xml; charset=utf-8" } },
	);
};
