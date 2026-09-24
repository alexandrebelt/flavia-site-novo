/**
 * Media storage abstraction backed by the R2 bucket bound as `MEDIA`.
 * Callers pass the bucket binding through (from `env.MEDIA`, imported from
 * "cloudflare:workers") rather than this module reaching for it itself.
 */
import path from "node:path";

const PUBLIC_PREFIX = "/media/";

const MB = 1024 * 1024;

// The only files the admin may upload, keyed by extension. The stored
// Content-Type always comes from this table — never from what the browser
// claims — so nothing can be uploaded as, or later served as, a web page
// or script (e.g. an .html file, or a .jpg that is really HTML).
const ALLOWED_TYPES = {
	".jpg": { type: "image/jpeg", maxBytes: 15 * MB },
	".jpeg": { type: "image/jpeg", maxBytes: 15 * MB },
	".png": { type: "image/png", maxBytes: 15 * MB },
	".webp": { type: "image/webp", maxBytes: 15 * MB },
	".gif": { type: "image/gif", maxBytes: 15 * MB },
	".avif": { type: "image/avif", maxBytes: 15 * MB },
	".svg": { type: "image/svg+xml", maxBytes: 2 * MB },
	".ico": { type: "image/x-icon", maxBytes: 1 * MB },
	".mp4": { type: "video/mp4", maxBytes: 95 * MB },
	".webm": { type: "video/webm", maxBytes: 95 * MB },
	".mov": { type: "video/quicktime", maxBytes: 95 * MB },
};

const ascii = (bytes, start, end) => String.fromCharCode(...bytes.slice(start, end));

// What the first bytes of each type really look like, so a renamed file
// (an .html saved as .png) is refused instead of stored.
const SIGNATURES = {
	"image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
	"image/png": (b) => b[0] === 0x89 && ascii(b, 1, 4) === "PNG",
	"image/gif": (b) => ascii(b, 0, 4) === "GIF8",
	"image/webp": (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
	"image/avif": (b) => ascii(b, 4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(b, 8, 12)),
	// Real ICO header, or a PNG saved as .ico (common, and browsers accept it).
	"image/x-icon": (b) =>
		(b[0] === 0 && b[1] === 0 && (b[2] === 1 || b[2] === 2) && b[3] === 0) ||
		(b[0] === 0x89 && ascii(b, 1, 4) === "PNG"),
	"video/mp4": (b) => ascii(b, 4, 8) === "ftyp",
	"video/quicktime": (b) => ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(ascii(b, 4, 8)),
	"video/webm": (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
	"image/svg+xml": (_b, text) => /<svg[\s>]/i.test(text),
};

/**
 * Checks an upload against ALLOWED_TYPES and its real content. Returns the
 * Content-Type to store it with, or an error message (in Portuguese —
 * shown in the admin).
 */
export async function checkUpload(file) {
	const ext = path.extname(file.name || "").toLowerCase();
	const rule = ALLOWED_TYPES[ext];
	if (!rule) {
		return { error: "Tipo de arquivo não permitido. Envie imagens (JPG, PNG, WebP, GIF, AVIF, SVG, ICO) ou vídeos (MP4, WebM, MOV)." };
	}
	if (file.size === 0) return { error: "O arquivo está vazio." };
	if (file.size > rule.maxBytes) {
		return { error: `Arquivo grande demais (máximo ${Math.round(rule.maxBytes / MB)} MB para ${ext}).` };
	}
	const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
	const text = rule.type === "image/svg+xml" ? new TextDecoder().decode(head) : "";
	if (!SIGNATURES[rule.type]?.(head, text)) {
		return { error: `O conteúdo do arquivo não é um ${ext} válido.` };
	}
	return { contentType: rule.type };
}

/** Type for a stored key, from its extension (used when serving). */
export function contentTypeFor(filename) {
	return ALLOWED_TYPES[path.extname(filename).toLowerCase()]?.type ?? "application/octet-stream";
}

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

/** Stores an upload already approved by checkUpload. */
export async function saveMedia(bucket, file, contentType) {
	const filename = safeFilename(file.name);
	const buffer = await file.arrayBuffer();
	await bucket.put(filename, buffer, {
		httpMetadata: { contentType },
	});
	return { url: `${PUBLIC_PREFIX}${filename}`, filename };
}

export async function deleteMedia(bucket, url) {
	if (!url.startsWith(PUBLIC_PREFIX)) return;
	await bucket.delete(url.slice(PUBLIC_PREFIX.length));
}

/** @returns {Promise<Array<{ url: string, filename: string, size: number, uploadedAt: string }>>} */
export async function listMedia(bucket) {
	const listed = await bucket.list();
	return listed.objects.map((obj) => ({
		url: `${PUBLIC_PREFIX}${obj.key}`,
		filename: obj.key,
		size: obj.size,
		uploadedAt: obj.uploaded.toISOString(),
	}));
}
