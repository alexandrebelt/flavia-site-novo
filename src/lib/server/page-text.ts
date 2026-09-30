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
import { htmlToText } from "./html-to-text";

const PAGE_COMPONENTS = {
	"/": HomePage,
	"/services": ServicesPage,
	"/about": AboutPage,
	"/portfolio": PortfolioPage,
	"/inquire": InquirePage,
} as const;


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
