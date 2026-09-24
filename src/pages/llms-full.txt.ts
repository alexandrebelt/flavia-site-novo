import type { APIRoute } from "astro";
import { buildLlmsFullTxt } from "../lib/server/llms";

export const GET: APIRoute = async ({ locals, url }) =>
	new Response(await buildLlmsFullTxt(locals, url), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			// Not a page for people — keep it out of search results.
			"X-Robots-Tag": "noindex",
		},
	});
