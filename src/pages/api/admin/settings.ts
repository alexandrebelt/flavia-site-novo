import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSettings, updateSettings } from "../../../lib/server/settings-store.js";
import { SOCIAL_NETWORKS, isValidSocialUrl } from "../../../data/social-links";
import { isProjectOrder } from "../../../lib/server/site-data";

// Only known networks, each either blank or a valid URL on its own domain —
// the same rule the admin form enforces, re-checked here.
function cleanSocialLinks(value: unknown): Record<string, string> {
	const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	return Object.fromEntries(
		SOCIAL_NETWORKS.map(({ key }) => {
			const url = typeof input[key] === "string" ? input[key].trim() : "";
			return [key, url && isValidSocialUrl(key, url) ? url : ""];
		}),
	);
}

export const prerender = false;

export const GET: APIRoute = async () => {
	const settings = await getSettings(env.DB);
	return Response.json(settings);
};

// The settings sections the admin screens edit; anything else is refused
// rather than stored.
const EDITABLE_KEYS = new Set(["siteTitle", "siteFaviconUrl", "bannerText", "home", "about", "seo", "projects"]);

export const POST: APIRoute = async ({ request }) => {
	const patch = (await request.json()) as Record<string, unknown>;
	if (!patch || typeof patch !== "object" || Object.keys(patch).some((key) => !EDITABLE_KEYS.has(key))) {
		return Response.json({ error: "Invalid settings." }, { status: 400 });
	}
	const seo = patch.seo as Record<string, unknown> | undefined;
	if (seo && "socialLinks" in seo) {
		seo.socialLinks = cleanSocialLinks(seo.socialLinks);
	}
	const projects = patch.projects as Record<string, unknown> | undefined;
	if (projects && "order" in projects && !isProjectOrder(projects.order)) {
		return Response.json({ error: "Invalid order." }, { status: 400 });
	}
	const settings = await updateSettings(env.DB, patch);
	return Response.json(settings);
};
