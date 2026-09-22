import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const filename = params.filename;
	if (!filename) return new Response("Not found", { status: 404 });

	const object = await env.MEDIA.get(filename);
	if (!object) return new Response("Not found", { status: 404 });

	return new Response(object.body, {
		headers: {
			"content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
};
