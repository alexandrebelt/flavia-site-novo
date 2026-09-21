import type { APIRoute } from "astro";
import { saveMedia } from "../../../lib/server/media-storage.js";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const form = await request.formData();
	const file = form.get("file");

	if (!(file instanceof File)) {
		return Response.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
	}

	const result = await saveMedia(file);
	return Response.json(result, { status: 201 });
};
