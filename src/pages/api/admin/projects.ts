import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { countFeaturedProjects, createProject, listProjects } from "../../../lib/server/projects-store.js";
import { MAX_FEATURED_PROJECTS } from "../../../lib/server/site-data";

export const prerender = false;

export const GET: APIRoute = async () => {
	const projects = await listProjects(env.DB);
	return Response.json(projects);
};

export const POST: APIRoute = async ({ request }) => {
	const project = (await request.json()) as Record<string, unknown>;

	// New projects only start featured if there's still a free slot.
	project.featured =
		project.featured === true && (await countFeaturedProjects(env.DB)) < MAX_FEATURED_PROJECTS;

	if (!project.id || !project.slug || !project.client) {
		return Response.json({ error: "id, slug e client são obrigatórios." }, { status: 400 });
	}

	try {
		const created = await createProject(env.DB, project);
		return Response.json(created, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro ao criar projeto.";
		return Response.json({ error: message }, { status: 409 });
	}
};
