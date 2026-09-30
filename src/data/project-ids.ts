/**
 * Project slugs and ids, shared by the admin form and the projects API.
 *
 * - slug: the project's address (/portfolio/<slug>) — filled in from the
 *   client name, editable.
 * - id: internal key, never shown on the site — generated automatically
 *   from the slug plus a short random suffix, so it stays unique even if
 *   the slug is later changed or reused.
 */

const MAX_LENGTH = 80;

/** "Sash Archives — Café!" → "sash-archives-cafe" */
export function slugify(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_LENGTH)
		.replace(/-+$/, "");
}

/** A short random suffix, e.g. "k3f9". */
export function randomIdSuffix(): string {
	return Math.random().toString(36).slice(2, 6).padEnd(4, "0");
}

export function buildProjectId(slug: string, suffix: string): string {
	return `${slugify(slug) || "project"}-${suffix}`;
}
