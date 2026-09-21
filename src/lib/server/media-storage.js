/**
 * Media storage abstraction.
 *
 * The admin panel always calls `saveMedia` / `deleteMedia` from this module —
 * never the filesystem directly. Today only the "local" driver exists (files
 * land in /public/uploads and are served as static assets). To move uploads
 * to an external service later (S3, Cloudinary, etc.), add a new driver below
 * implementing the same two functions and switch it with the
 * MEDIA_STORAGE_DRIVER env var — nothing calling this module needs to change.
 */
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const UPLOADS_DIR = fileURLToPath(new URL("../../../public/uploads/", import.meta.url));
const PUBLIC_PREFIX = "/uploads/";

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

const drivers = {
	async local(file) {
		await mkdir(UPLOADS_DIR, { recursive: true });
		const filename = safeFilename(file.name);
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(path.join(UPLOADS_DIR, filename), buffer);
		return { url: `${PUBLIC_PREFIX}${filename}`, filename };
	},
	async localDelete(url) {
		if (!url.startsWith(PUBLIC_PREFIX)) return;
		const filename = url.slice(PUBLIC_PREFIX.length);
		await unlink(path.join(UPLOADS_DIR, filename)).catch(() => {});
	},

	// TODO: implement when a bucket/credentials exist. Must return the same
	// shape as `local`: { url, filename }.
	// async s3(file) { ... },
	// async s3Delete(url) { ... },
};

const DRIVER = process.env.MEDIA_STORAGE_DRIVER || "local";

export async function saveMedia(file) {
	const save = drivers[DRIVER];
	if (!save) throw new Error(`Unknown media storage driver: "${DRIVER}"`);
	return save(file);
}

export async function deleteMedia(url) {
	const del = drivers[`${DRIVER}Delete`];
	if (!del) throw new Error(`Unknown media storage driver: "${DRIVER}"`);
	return del(url);
}
