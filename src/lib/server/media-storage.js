/**
 * Media storage abstraction backed by the R2 bucket bound as `MEDIA`.
 * Callers pass the bucket binding through (from `env.MEDIA`, imported from
 * "cloudflare:workers") rather than this module reaching for it itself.
 */
import path from "node:path";

const PUBLIC_PREFIX = "/media/";

function safeFilename(originalName) {
	const ext = path.extname(originalName).toLowerCase();
	const base = path
		.basename(originalName, ext)
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return `${unique}-${base || "file"}${ext}`;
}

export async function saveMedia(bucket, file) {
	const filename = safeFilename(file.name);
	const buffer = await file.arrayBuffer();
	await bucket.put(filename, buffer, {
		httpMetadata: { contentType: file.type || "application/octet-stream" },
	});
	return { url: `${PUBLIC_PREFIX}${filename}`, filename };
}

export async function deleteMedia(bucket, url) {
	if (!url.startsWith(PUBLIC_PREFIX)) return;
	await bucket.delete(url.slice(PUBLIC_PREFIX.length));
}

export async function listMedia(bucket) {
	const listed = await bucket.list();
	return listed.objects.map((obj) => ({
		url: `${PUBLIC_PREFIX}${obj.key}`,
		filename: obj.key,
		size: obj.size,
		uploadedAt: obj.uploaded.toISOString(),
	}));
}
