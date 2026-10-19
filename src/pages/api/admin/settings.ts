import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSettings, updateSettings } from "../../../lib/server/settings-store.js";
import { SOCIAL_NETWORKS, isValidSocialUrl } from "../../../data/social-links";
import { isProjectOrder } from "../../../lib/server/site-data";
import { normalizeRecognitions } from "../../../data/recognitions";
import { normalizeTestimonials } from "../../../data/testimonials";
import { MARKETING_FIELDS, invalidMarketingKeys, normalizeMarketing } from "../../../data/marketing";

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
const EDITABLE_KEYS = new Set([
	"siteTitle",
	"siteFaviconUrl",
	"bannerText",
	"home",
	"about",
	"services",
	"marketing",
	"seo",
	"projects",
	"testimonials",
]);

export const POST: APIRoute = async ({ request }) => {
	const patch = (await request.json()) as Record<string, unknown>;
	if (!patch || typeof patch !== "object" || Object.keys(patch).some((key) => !EDITABLE_KEYS.has(key))) {
		return Response.json({ error: "Invalid settings." }, { status: 400 });
	}
	const seo = patch.seo as Record<string, unknown> | undefined;
	if (seo && "socialLinks" in seo) {
		seo.socialLinks = cleanSocialLinks(seo.socialLinks);
	}
	// Recognitions: text required, links only if they are real web links.
	const about = patch.about as Record<string, unknown> | undefined;
	if (about && "recognitions" in about) {
		about.recognitions = normalizeRecognitions(about.recognitions);
	}
	// Marketing tags: each ID blank or in its platform's format — a wrong
	// one is refused (not silently dropped) so the admin sees which.
	if ("marketing" in patch) {
		const invalid = invalidMarketingKeys(patch.marketing);
		if (invalid.length) {
			const labels = invalid.map((key) => MARKETING_FIELDS.find((f) => f.key === key)?.label);
			return Response.json({ error: `Invalid ID: ${labels.join(", ")}.` }, { status: 400 });
		}
		patch.marketing = normalizeMarketing(patch.marketing);
	}
	// Testimonials: a quote is required; text trimmed and length-capped.
	if ("testimonials" in patch) {
		patch.testimonials = normalizeTestimonials(patch.testimonials);
	}
	const projects = patch.projects as Record<string, unknown> | undefined;
	if (projects && "order" in projects && !isProjectOrder(projects.order)) {
		return Response.json({ error: "Invalid order." }, { status: 400 });
	}
	if (projects && "customOrder" in projects) {
		const ids = projects.customOrder;
		const valid =
			Array.isArray(ids) &&
			ids.length <= 1000 &&
			ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 200) &&
			new Set(ids).size === ids.length;
		if (!valid) return Response.json({ error: "Invalid project list order." }, { status: 400 });
	}
	const settings = await updateSettings(env.DB, patch);
	return Response.json(settings);
};
