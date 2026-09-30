import type { APIRoute } from "astro";
import { siteOrigin } from "../lib/server/site-data";

const AI_ASSISTANT_BOTS = [
	"ChatGPT-User",
	"OAI-SearchBot",
	"Claude-User",
	"Claude-SearchBot",
	"PerplexityBot",
	"Perplexity-User",
];

const AI_TRAINING_BOTS = [
	"GPTBot",
	"ClaudeBot",
	"Google-Extended",
	"Applebot-Extended",
	"CCBot",
	"meta-externalagent",
	"Bytespider",
];

// Follows the admin's "Permitir que buscadores indexem o site" switch.
export const GET: APIRoute = async ({ locals, url }) => {
	const settings = await locals.siteSettings();
	const origin = siteOrigin(settings, url);
	const allowIndexing = settings.seo.allowIndexing !== false;

	const privatePaths = ["Disallow: /admin", "Disallow: /api/", "Disallow: /partials/"];

	// When indexing is on: search engines and AI assistants/AI search may
	// read and cite the site, but it must not be used to train AI models —
	// declared both as Content Signals (https://contentsignals.org) and by
	// blocking the known training crawlers by name.
	const body = allowIndexing
		? [
				"# Content Signals: search=yes (search indexing), ai-input=yes (AI answers",
				"# citing the site), ai-train=no (no training or fine-tuning AI models).",
				"User-agent: *",
				"Content-Signal: search=yes, ai-input=yes, ai-train=no",
				"Allow: /",
				...privatePaths,
				"",
				"# AI assistants and AI search: allowed.",
				...AI_ASSISTANT_BOTS.map((bot) => `User-agent: ${bot}`),
				"Allow: /",
				...privatePaths,
				"",
				"# AI training crawlers: not allowed.",
				...AI_TRAINING_BOTS.map((bot) => `User-agent: ${bot}`),
				"Disallow: /",
				"",
				`Sitemap: ${origin}/sitemap.xml`,
			]
		: ["User-agent: *", "Disallow: /"];

	return new Response(`${body.join("\n")}\n`, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
