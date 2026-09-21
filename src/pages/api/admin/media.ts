import type { APIRoute } from "astro";
import { readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { deleteMedia } from "../../../lib/server/media-storage.js";

export const prerender = false;

const UPLOADS_DIR = fileURLToPath(new URL("../../../../public/uploads/", import.meta.url));

export const GET: APIRoute = async () => {
	let filenames: string[] = [];
	try {
		filenames = (await readdir(UPLOADS_DIR)).filter((name) => !name.startsWith("."));
	} catch {
		filenames = [];
	}

	const files = await Promise.all(
		filenames.map(async (filename) => {
			const stats = await stat(path.join(UPLOADS_DIR, filename));
			return {
				url: `/uploads/${filename}`,
				filename,
				size: stats.size,
				uploadedAt: stats.mtime.toISOString(),
			};
		}),
	);

	files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
	return Response.json(files);
};

export const DELETE: APIRoute = async ({ request }) => {
	const { url } = await request.json();
	if (typeof url !== "string") {
		return Response.json({ error: "url é obrigatório." }, { status: 400 });
	}
	await deleteMedia(url);
	return new Response(null, { status: 204 });
};
