/**
 * Plain-text versions of the public pages, for /llms-full.txt. The pages are
 * rendered with Astro's container API — the exact same components and D1
 * data visitors get — and reduced to readable text, so this never drifts
 * from what's actually on the site.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import HomePage from "../../pages/index.astro";
import ServicesPage from "../../pages/services.astro";
import AboutPage from "../../pages/about.astro";
import PortfolioPage from "../../pages/portfolio/index.astro";
import InquirePage from "../../pages/inquire.astro";
import ProjectPage from "../../pages/portfolio/[slug].astro";

const PAGE_COMPONENTS = {
	"/": HomePage,
	"/services": ServicesPage,
	"/about": AboutPage,
	"/portfolio": PortfolioPage,
	"/inquire": InquirePage,
} as const;

const DROPPED_ELEMENTS = /<(script|style|svg|noscript|template|video|button|select|textarea)\b[\s\S]*?<\/\1>/gi;

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	rarr: "→",
	larr: "←",
	middot: "·",
	mdash: "—",
	ndash: "–",
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
		if (code[0] === "#") {
			const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
			return Number.isFinite(value) ? String.fromCodePoint(value) : match;
		}
		return ENTITIES[code.toLowerCase()] ?? match;
	});
}

/** The page's <main> as Markdown-ish text: headings, list items, paragraphs. */
export function htmlToText(html: string): string {
	const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
	const text = main
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(DROPPED_ELEMENTS, "")
		.replace(/<h([1-6])\b[^>]*>/gi, (_, level: string) => `\n\n${"#".repeat(Number(level))} `)
		.replace(/<\/h[1-6]>/gi, "\n\n")
		.replace(/<li\b[^>]*>/gi, "\n- ")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|section|ul|ol|dl|dd|dt|label|legend|fieldset|form)>/gi, "\n")
		.replace(/<[^>]+>/g, " ");

	return decodeEntities(text)
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

let containerPromise: ReturnType<typeof AstroContainer.create> | undefined;

async function renderPage(
	component: (typeof PAGE_COMPONENTS)[keyof typeof PAGE_COMPONENTS] | typeof ProjectPage,
	path: string,
	locals: App.Locals,
	origin: string,
	params?: Record<string, string>,
): Promise<string> {
	containerPromise ??= AstroContainer.create();
	const container = await containerPromise;
	const html = await container.renderToString(component, {
		locals,
		params,
		request: new Request(new URL(path, origin)),
	});
	return htmlToText(html);
}

export async function renderPagesAsText(
	locals: App.Locals,
	origin: string,
): Promise<Array<{ path: string; text: string }>> {
	const projects = await locals.projects();
	const jobs = [
		...Object.entries(PAGE_COMPONENTS).map(([path, component]) => ({ path, component, params: undefined })),
		...projects.map((project) => ({
			path: `/portfolio/${project.slug}`,
			component: ProjectPage,
			params: { slug: project.slug },
		})),
	];
	return Promise.all(
		jobs.map(async ({ path, component, params }) => ({
			path,
			text: await renderPage(component, path, locals, origin, params),
		})),
	);
}
