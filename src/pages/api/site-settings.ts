import type { APIRoute } from "astro";
import { getSettings } from "../../lib/server/settings-store.js";

export const prerender = false;

/**
 * Public, read-only subset of settings.json for pages that are prerendered
 * (built once) but need to reflect admin changes without a rebuild — e.g.
 * the homepage video. Never expose anything here that isn't meant to be
 * public.
 */
export const GET: APIRoute = async () => {
	const settings = await getSettings();
	return Response.json({
		home: settings.home ?? {},
		about: settings.about ?? {},
		siteFaviconUrl: settings.siteFaviconUrl ?? "",
		bannerText: settings.bannerText ?? "",
	});
};
