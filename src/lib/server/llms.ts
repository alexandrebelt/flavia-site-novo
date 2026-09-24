/**
 * /llms.txt and /llms-full.txt (https://llmstxt.org): an unlinked, plain-text
 * map of the site for AI assistants and crawlers — who the studio is, every
 * page and project, and how to get in touch. Built from D1 on each request.
 */
import { SOCIAL_NETWORKS, resolveSocialUrl } from "../../data/social-links";
import { PUBLIC_PAGES, siteOrigin } from "./site-data";
import { renderPagesAsText } from "./page-text";

const FALLBACK_SUMMARY =
	"Flávia Jackeline is an independent Brazilian brand studio creating refined, distinctive identities for founders and businesses worldwide.";
const CONTACT_EMAIL = "hello@flaviajackeline.com";

async function header(locals: App.Locals, url: URL) {
	const settings = await locals.siteSettings();
	const origin = siteOrigin(settings, url);
	const profiles = SOCIAL_NETWORKS.map((network) => ({
		label: network.label,
		url: resolveSocialUrl(network.key, settings.seo.socialLinks),
		isDefault: resolveSocialUrl(network.key, settings.seo.socialLinks) === network.defaultUrl,
	})).filter((profile) => !profile.isDefault);

	const lines = [
		`# ${settings.siteTitle || "Flávia Jackeline"}`,
		"",
		`> ${settings.seo.defaultDescription || FALLBACK_SUMMARY}`,
		"",
		"## Contact",
		"",
		`- Start a project: ${origin}/inquire`,
		`- Email: ${CONTACT_EMAIL}`,
		...profiles.map((profile) => `- ${profile.label}: ${profile.url}`),
	];
	return { origin, lines };
}

export async function buildLlmsTxt(locals: App.Locals, url: URL): Promise<string> {
	const { origin, lines } = await header(locals, url);
	const projects = await locals.projects();

	return [
		...lines,
		"",
		"## Pages",
		"",
		...PUBLIC_PAGES.map((page) => `- [${page.name}](${origin}${page.path})`),
		"",
		"## Projects",
		"",
		...projects.map((project) => {
			const facts = [project.category, project.segment, project.country, project.year]
				.filter(Boolean)
				.join(", ");
			const summary = project.shortDescription ? `: ${project.shortDescription}` : "";
			return `- [${project.client}](${origin}/portfolio/${project.slug}) (${facts})${summary}`;
		}),
		"",
		"## Optional",
		"",
		`- [Full text of every page](${origin}/llms-full.txt)`,
		"",
	].join("\n");
}

export async function buildLlmsFullTxt(locals: App.Locals, url: URL): Promise<string> {
	const { origin, lines } = await header(locals, url);
	const pages = await renderPagesAsText(locals, origin);

	return [
		...lines,
		"",
		...pages.flatMap(({ path, text }) => ["---", "", `Source: ${origin}${path}`, "", text, ""]),
	].join("\n");
}
