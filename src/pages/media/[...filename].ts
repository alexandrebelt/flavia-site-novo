import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { contentTypeFor } from "../../lib/server/media-storage.js";

export const prerender = false;

const BASE_HEADERS = {
	"cache-control": "public, max-age=31536000, immutable",
	// Even if an uploaded SVG carried a script, opening it directly
	// runs nothing: sandboxed, no scripts, no plugins, no framing.
	"content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox",
	"x-content-type-options": "nosniff",
	// Safari / iOS only play a video when the server answers byte-range
	// requests (206), so ranges are advertised and honoured below.
	"accept-ranges": "bytes",
};

/**
 * One "bytes=start-end" range (the only kind browsers send for media),
 * resolved against the file size. null = no/unsupported Range header
 * (serve the whole file); "invalid" = unsatisfiable (416).
 */
function parseRange(header: string | null, size: number): { offset: number; length: number } | null | "invalid" {
	if (!header) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) return null;
	const [, startText, endText] = match;
	if (!startText && !endText) return null;

	let start: number;
	let end: number;
	if (!startText) {
		// "bytes=-500": the last 500 bytes.
		const suffix = Number(endText);
		if (suffix === 0) return "invalid";
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = Number(startText);
		end = endText ? Math.min(Number(endText), size - 1) : size - 1;
	}
	if (start >= size || end < start) return "invalid";
	return { offset: start, length: end - start + 1 };
}

export const GET: APIRoute = async ({ params, request }) => {
	const filename = params.filename;
	if (!filename) return new Response("Not found", { status: 404 });

	const headers: Record<string, string> = {
		...BASE_HEADERS,
		// From the extension, not the stored metadata, so a file can only
		// ever be served as one of the allowed image/video types.
		"content-type": contentTypeFor(filename),
	};

	const rangeHeader = request.headers.get("range");
	if (rangeHeader) {
		const head = await env.MEDIA.head(filename);
		if (!head) return new Response("Not found", { status: 404 });
		const range = parseRange(rangeHeader, head.size);
		if (range === "invalid") {
			return new Response(null, {
				status: 416,
				headers: { ...headers, "content-range": `bytes */${head.size}` },
			});
		}
		if (range) {
			const part = await env.MEDIA.get(filename, { range });
			if (!part) return new Response("Not found", { status: 404 });
			return new Response(part.body, {
				status: 206,
				headers: {
					...headers,
					etag: head.httpEtag,
					"content-length": String(range.length),
					"content-range": `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`,
				},
			});
		}
	}

	const object = await env.MEDIA.get(filename);
	if (!object) return new Response("Not found", { status: 404 });
	return new Response(object.body, {
		headers: { ...headers, etag: object.httpEtag, "content-length": String(object.size) },
	});
};
