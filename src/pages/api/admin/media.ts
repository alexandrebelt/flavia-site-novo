import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { deleteMedia, listMedia } from "../../../lib/server/media-storage.js";

export const prerender = false;

export const GET: APIRoute = async () => {
	const files = await listMedia(env.MEDIA);
	files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
	return Response.json(files);
};

export const DELETE: APIRoute = async ({ request }) => {
	const { url } = (await request.json()) as { url?: unknown };
	if (typeof url !== "string") {
		return Response.json({ error: "url is required." }, { status: 400 });
	}
	await deleteMedia(env.MEDIA, url);
	return new Response(null, { status: 204 });
};
