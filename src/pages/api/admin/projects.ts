import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { countFeaturedProjects, createProject, listProjects } from "../../../lib/server/projects-store.js";
import { MAX_FEATURED_PROJECTS } from "../../../lib/server/site-data";
import { normalizeGallery } from "../../../data/video-embeds";

export const prerender = false;

export const GET: APIRoute = async () => {
	const projects = await listProjects(env.DB);
	return Response.json(projects);
};

export const POST: APIRoute = async ({ request }) => {
	const project = (await request.json()) as Record<string, unknown>;

	project.images = normalizeGallery(project.images);
	// New projects only start featured if there's still a free slot.
	project.featured =
		project.featured === true && (await countFeaturedProjects(env.DB)) < MAX_FEATURED_PROJECTS;
	project.featuredAt = project.featured ? Date.now() : null;

	if (!project.id || !project.slug || !project.client) {
		return Response.json({ error: "id, slug and client are required." }, { status: 400 });
	}

	try {
		const created = await createProject(env.DB, project);
		return Response.json(created, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Couldn't create the project.";
		return Response.json({ error: message }, { status: 409 });
	}
};
