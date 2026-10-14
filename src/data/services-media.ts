/**
 * The Services page's "Brand Identity" media (admin › Services) is either a
 * GIF/image or a video; uploads are stored under their real extension, so
 * the URL alone tells which element to render.
 */
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov)$/i;

export function isVideoUrl(url: string): boolean {
	return VIDEO_EXTENSIONS.test(url.split(/[?#]/)[0]);
}
