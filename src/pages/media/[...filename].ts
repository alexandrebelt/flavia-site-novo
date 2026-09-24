import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { contentTypeFor } from "../../lib/server/media-storage.js";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const filename = params.filename;
	if (!filename) return new Response("Not found", { status: 404 });

	const object = await env.MEDIA.get(filename);
	if (!object) return new Response("Not found", { status: 404 });

	return new Response(object.body, {
		headers: {
			// From the extension, not the stored metadata, so a file can only
			// ever be served as one of the allowed image/video types.
			"content-type": contentTypeFor(filename),
			"cache-control": "public, max-age=31536000, immutable",
			// Even if an uploaded SVG carried a script, opening it directly
			// runs nothing: sandboxed, no scripts, no plugins, no framing.
			"content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox",
			"x-content-type-options": "nosniff",
		},
	});
};
