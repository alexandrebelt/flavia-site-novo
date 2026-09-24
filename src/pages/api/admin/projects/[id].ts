import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	countFeaturedProjects,
	deleteProject,
	getProjectById,
	updateProject,
} from "../../../../lib/server/projects-store.js";
import { MAX_FEATURED_PROJECTS } from "../../../../lib/server/site-data";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const project = await getProjectById(env.DB, params.id!);
	if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
	return Response.json(project);
};

export const PUT: APIRoute = async ({ params, request }) => {
	const patch = (await request.json()) as Record<string, unknown>;
	if ("featured" in patch) {
		patch.featured = patch.featured === true;
		if (patch.featured && (await countFeaturedProjects(env.DB, params.id)) >= MAX_FEATURED_PROJECTS) {
			return Response.json(
				{ error: `At most ${MAX_FEATURED_PROJECTS} featured projects. Untick one first.` },
				{ status: 409 },
			);
		}
	}
	const updated = await updateProject(env.DB, params.id!, patch);
	if (!updated) return Response.json({ error: "Project not found." }, { status: 404 });
	return Response.json(updated);
};

export const DELETE: APIRoute = async ({ params }) => {
	const ok = await deleteProject(env.DB, params.id!);
	if (!ok) return Response.json({ error: "Project not found." }, { status: 404 });
	return new Response(null, { status: 204 });
};
