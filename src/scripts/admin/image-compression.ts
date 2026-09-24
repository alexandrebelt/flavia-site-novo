/**
 * Compresses photos in the admin's browser before they're uploaded: scaled
 * down to fit MAX_DIMENSION and re-encoded as WebP, whatever format was
 * picked (JPG, PNG, WebP, AVIF). The site then only ever serves the small
 * WebP. GIF (may be animated), SVG (vector) and ICO are left untouched.
 */

/** Longest side after resizing — sharp on large/retina screens, still light. */
export const MAX_IMAGE_DIMENSION = 2560;
/** Largest original the admin accepts before compression. */
export const MAX_ORIGINAL_MB = 25;
const WEBP_QUALITY = 0.82;

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renameTo(name: string, extension: string): string {
	const base = name.replace(/\.[^.]+$/, "") || "image";
	return `${base}.${extension}`;
}

export async function compressImage(
	file: File,
	maxDimension: number = MAX_IMAGE_DIMENSION,
): Promise<File> {
	if (!COMPRESSIBLE_TYPES.has(file.type)) return file;
	if (file.size > MAX_ORIGINAL_MB * 1024 * 1024) {
		throw new Error(`${file.name} is larger than ${MAX_ORIGINAL_MB} MB.`);
	}

	let bitmap: ImageBitmap;
	try {
		// "from-image" applies the photo's EXIF rotation (portrait phone shots).
		bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		throw new Error(`${file.name} couldn't be read as an image.`);
	}

	const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	const context = canvas.getContext("2d");
	if (!context) {
		bitmap.close();
		return file;
	}
	context.imageSmoothingQuality = "high";
	context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();

	const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
	if (webp && webp.type === "image/webp") {
		// An already-optimised WebP that didn't need resizing can come out
		// bigger when re-encoded — keep the original then.
		if (file.type === "image/webp" && scale === 1 && webp.size >= file.size) return file;
		return new File([webp], renameTo(file.name, "webp"), { type: "image/webp" });
	}

	// A browser that can't encode WebP (some older Safari versions): fall
	// back to a resized JPEG for photos; PNGs keep their transparency as-is.
	if (file.type === "image/jpeg") {
		const jpeg = await canvasToBlob(canvas, "image/jpeg", WEBP_QUALITY);
		if (jpeg && jpeg.size < file.size) {
			return new File([jpeg], renameTo(file.name, "jpg"), { type: "image/jpeg" });
		}
	}
	return file;
}
