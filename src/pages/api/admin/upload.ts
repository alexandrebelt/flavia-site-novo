import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { checkUpload, saveMedia } from "../../../lib/server/media-storage.js";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const form = await request.formData();
	const file = form.get("file");

	if (!(file instanceof File)) {
		return Response.json({ error: "No file sent." }, { status: 400 });
	}

	const check = await checkUpload(file);
	if (check.error || !check.contentType) {
		return Response.json({ error: check.error }, { status: 400 });
	}

	const result = await saveMedia(env.MEDIA, file, check.contentType);
	return Response.json(result, { status: 201 });
};
