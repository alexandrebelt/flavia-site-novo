/**
 * Upload limits shared by the upload API (media-storage.js, which enforces
 * them) and the admin screens (which check before sending, so a too-large
 * file is refused instantly instead of after a long upload).
 *
 * Videos are only used as short background loops (~5 MB recommended); the
 * cap keeps storage in check and stays well inside the Worker's memory,
 * which holds the whole upload while it's received.
 */
export const MAX_VIDEO_MB = 30;
