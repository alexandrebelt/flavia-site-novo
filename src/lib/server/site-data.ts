/**
 * What the public pages render from. Everything the admin edits lives in D1
 * (settings row "site", projects table); the pages are rendered on the
 * server per request, so a save in the admin is live on the next page view
 * — no rebuild — and crawlers/link previews (WhatsApp, LinkedIn) get the
 * real values straight in the HTML.
 *
 * settings.json only holds the defaults for keys the admin hasn't saved
 * yet; it's never the source of truth.
 */
import defaults from "../../data/settings.json";
import { getSettings } from "./settings-store.js";
import { getProjectBySlug, listProjects } from "./projects-store.js";
import { isVideoItem, type GalleryItem } from "../../data/video-embeds";

export type SiteSettings = typeof defaults & {
	/** customOrder: project ids as arranged by drag-and-drop in the admin list. */
	projects: { order: string; customOrder?: string[] };
};

export interface DescriptionBlock {
	type: string;
	text: string;
}

export interface Project {
	id: string;
	slug: string;
	client: string;
	country: string;
	segment: string;
	year: number;
	category: string;
	tags: string[];
	shortDescription: string;
	description: DescriptionBlock[];
	/** Gallery, in display order: images and YouTube/Vimeo videos mixed. */
	images: GalleryItem[];
	thumbnail: string;
	/** Pinned to the top of every list (home shows the first 3). */
	featured?: boolean;
	/** When it was ticked as featured (ms) — featured projects lead in that order. */
	featuredAt?: number | null;
}

/** "custom" = the order the projects were dragged into in the admin list. */
export type ProjectOrder = "newest" | "oldest" | "custom";
export const PROJECT_ORDERS: readonly ProjectOrder[] = ["newest", "oldest", "custom"];
export const MAX_FEATURED_PROJECTS = 3;
/** Portfolio renders this many at first, then lazy-loads the rest in pages of the same size. */
export const PROJECTS_PAGE_SIZE = 10;

export function isProjectOrder(value: unknown): value is ProjectOrder {
	return PROJECT_ORDERS.includes(value as ProjectOrder);
}

/**
 * The one ordering every public list uses (home, portfolio, covers,
 * sitemap, llms.txt):
 *
 * 1. Featured projects first, in the order they were ticked (first ticked
 *    is first).
 * 2. Then the rest, per the admin's choice:
 *    - "newest" / "oldest": by project year, ties broken by when the
 *      project was added (newer additions count as newer);
 *    - "custom": the order they were dragged into in the admin list
 *      (`customOrder`); projects not placed there yet (just created) go
 *      last, in the order they were added.
 *
 * The home page simply takes the first 3 of this, so up to 3 featured
 * projects lead and any free slots fall back to the chosen order.
 */
export function orderProjects(
	projects: Project[],
	order: ProjectOrder,
	customOrder: readonly string[] = [],
): Project[] {
	const direction = order === "oldest" ? 1 : -1;
	const customIndex = new Map(customOrder.map((id, index) => [id, index]));
	const placed = (id: string) => customIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
	const ranked = projects.map((project, addedIndex) => ({ project, addedIndex }));

	ranked.sort((a, b) => {
		const featuredFirst = Number(!!b.project.featured) - Number(!!a.project.featured);
		if (featuredFirst) return featuredFirst;
		if (a.project.featured) {
			return (a.project.featuredAt ?? 0) - (b.project.featuredAt ?? 0) || a.addedIndex - b.addedIndex;
		}
		if (order === "custom") {
			return placed(a.project.id) - placed(b.project.id) || a.addedIndex - b.addedIndex;
		}
		return (
			direction * ((a.project.year || 0) - (b.project.year || 0)) ||
			direction * (a.addedIndex - b.addedIndex)
		);
	});
	return ranked.map(({ project }) => project);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Stored values over defaults, one level deep (same shape updateSettings writes). */
export async function loadSiteSettings(db: D1Database): Promise<SiteSettings> {
	const stored = (await getSettings(db)) as Record<string, unknown>;
	const merged: Record<string, unknown> = { ...defaults };
	for (const [key, value] of Object.entries(stored)) {
		const fallback = (defaults as Record<string, unknown>)[key];
		merged[key] =
			isPlainObject(value) && isPlainObject(fallback) ? { ...fallback, ...value } : value;
	}
	return merged as SiteSettings;
}

/** In the order they were added (the admin list's raw order). */
export async function loadProjects(db: D1Database): Promise<Project[]> {
	return (await listProjects(db)) as Project[];
}

/** In the public order — see orderProjects. */
export async function loadOrderedProjects(db: D1Database, settings: SiteSettings): Promise<Project[]> {
	const order = isProjectOrder(settings.projects?.order) ? settings.projects.order : "newest";
	return orderProjects(await loadProjects(db), order, settings.projects?.customOrder ?? []);
}

export async function loadProject(db: D1Database, slug: string): Promise<Project | null> {
	return (await getProjectBySlug(db, slug)) as Project | null;
}

/** The image a project is represented by in lists and link previews. */
export function projectCover(project: Project): string {
	return project.thumbnail || project.images?.find((item) => !isVideoItem(item))?.url || "";
}

/**
 * Base for absolute URLs (canonical, previews, sitemap). The admin's "URL do
 * site" wins; until it's filled in, the domain the request came in on.
 */
export function siteOrigin(settings: SiteSettings, requestUrl: URL): string {
	return (settings.seo.siteUrl || requestUrl.origin).replace(/\/$/, "");
}

/** The site's fixed pages — what the sitemap and llms.txt list, in menu order. */
export const PUBLIC_PAGES = [
	{ path: "/", name: "Home" },
	{ path: "/services", name: "Services" },
	{ path: "/about", name: "About" },
	{ path: "/portfolio", name: "Portfolio" },
	{ path: "/inquire", name: "Inquire" },
] as const;
