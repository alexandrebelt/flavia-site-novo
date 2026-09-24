/**
 * YouTube / Vimeo videos inside a project's gallery (admin › Projects).
 *
 * Only the pasted link and a display mode are entered; the link is parsed
 * into provider + video id, and the embed URL is always rebuilt from those
 * — a stored link is never put into an <iframe> as-is.
 *
 * Modes:
 * - "loop":   autoplays muted and loops, no controls, not clickable — a
 *             clean moving image, like a GIF.
 * - "player": the normal player, with controls; the visitor presses play.
 */
export type VideoMode = "loop" | "player";
export const VIDEO_MODES: readonly VideoMode[] = ["loop", "player"];

export type VideoProvider = "youtube" | "vimeo";

export interface ParsedVideo {
	provider: VideoProvider;
	id: string;
	/** Vimeo's privacy hash, for unlisted videos (vimeo.com/123/abc123). */
	hash?: string;
}

export interface ProjectVideo extends ParsedVideo {
	type: "video";
	/** The link as pasted in the admin, kept for editing. */
	url: string;
	mode: VideoMode;
}

export interface ProjectImageItem {
	type?: "image";
	url: string;
	alt: string;
}

export type GalleryItem = ProjectImageItem | ProjectVideo;

/** Where embeds are served from — also allowed in the site's CSP frame-src. */
export const VIDEO_EMBED_ORIGINS = ["https://www.youtube-nocookie.com", "https://player.vimeo.com"];

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = ["youtube.com", "youtube-nocookie.com", "youtu.be"];

function hostMatches(host: string, domains: string[]): boolean {
	return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** A YouTube or Vimeo link in any of its usual shapes → provider + id, or null. */
export function parseVideoUrl(input: string): ParsedVideo | null {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	const host = url.hostname.toLowerCase();
	const parts = url.pathname.split("/").filter(Boolean);

	if (hostMatches(host, YOUTUBE_HOSTS)) {
		let id: string | null | undefined;
		if (host === "youtu.be" || host.endsWith(".youtu.be")) id = parts[0];
		else if (parts[0] === "watch") id = url.searchParams.get("v");
		else if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) id = parts[1];
		return id && YOUTUBE_ID.test(id) ? { provider: "youtube", id } : null;
	}

	if (hostMatches(host, ["vimeo.com"])) {
		// vimeo.com/123456, vimeo.com/123456/abcdef (unlisted),
		// vimeo.com/channels/x/123456, player.vimeo.com/video/123456?h=abcdef
		const idIndex = parts.findIndex((part) => /^\d+$/.test(part));
		if (idIndex < 0) return null;
		const id = parts[idIndex];
		const next = parts[idIndex + 1];
		const hash = url.searchParams.get("h") ?? (next && /^[a-f0-9]+$/i.test(next) ? next : undefined);
		return { provider: "vimeo", id, ...(hash && /^[a-f0-9]+$/i.test(hash) ? { hash } : {}) };
	}

	return null;
}

export function videoEmbedUrl(video: ParsedVideo, mode: VideoMode): string {
	if (video.provider === "youtube") {
		const params = new URLSearchParams(
			mode === "loop"
				? {
						autoplay: "1",
						mute: "1",
						loop: "1",
						// YouTube only loops a single video when it's also its own playlist.
						playlist: video.id,
						controls: "0",
						disablekb: "1",
						modestbranding: "1",
						playsinline: "1",
						rel: "0",
						iv_load_policy: "3",
					}
				: { modestbranding: "1", playsinline: "1", rel: "0" },
		);
		return `https://www.youtube-nocookie.com/embed/${video.id}?${params}`;
	}

	const params = new URLSearchParams(
		mode === "loop"
			? // Vimeo's "background" mode: autoplay, muted, looping, no controls.
				{ background: "1", dnt: "1" }
			: { dnt: "1", title: "0", byline: "0", portrait: "0" },
	);
	if (video.hash) params.set("h", video.hash);
	return `https://player.vimeo.com/video/${video.id}?${params}`;
}

export function isVideoItem(item: unknown): item is ProjectVideo {
	return !!item && typeof item === "object" && (item as { type?: unknown }).type === "video";
}

/**
 * Cleans a project's gallery as sent by the admin: images keep a string
 * url + alt; videos are re-parsed from their link (anything that isn't a
 * valid YouTube/Vimeo link is dropped) and get a known mode.
 */
export function normalizeGallery(value: unknown): GalleryItem[] {
	if (!Array.isArray(value)) return [];
	const items: GalleryItem[] = [];
	for (const raw of value) {
		if (typeof raw === "string") {
			if (raw.trim()) items.push({ url: raw.trim(), alt: "" });
			continue;
		}
		if (!raw || typeof raw !== "object") continue;
		const record = raw as Record<string, unknown>;
		const url = typeof record.url === "string" ? record.url.trim() : "";
		if (!url) continue;

		if (record.type === "video") {
			const parsed = parseVideoUrl(url);
			if (!parsed) continue;
			const mode = VIDEO_MODES.includes(record.mode as VideoMode) ? (record.mode as VideoMode) : "loop";
			items.push({ type: "video", url, mode, ...parsed });
		} else {
			items.push({ url, alt: typeof record.alt === "string" ? record.alt.trim() : "" });
		}
	}
	return items.slice(0, 200);
}
