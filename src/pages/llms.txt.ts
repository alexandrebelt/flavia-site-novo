import type { APIRoute } from "astro";
import { buildLlmsTxt } from "../lib/server/llms";

export const GET: APIRoute = async ({ locals, url }) =>
	new Response(await buildLlmsTxt(locals, url), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			// Not a page for people — keep it out of search results.
			"X-Robots-Tag": "noindex",
		},
	});
