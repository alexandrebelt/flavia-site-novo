import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	countFeaturedProjects,
	deleteProject,
	getProjectById,
	updateProject,
} from "../../../../lib/server/projects-store.js";
import { MAX_FEATURED_PROJECTS } from "../../../../lib/server/site-data";
import { normalizeGallery } from "../../../../data/video-embeds";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const project = await getProjectById(env.DB, params.id!);
	if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
	return Response.json(project);
};

export const PUT: APIRoute = async ({ params, request }) => {
	const patch = (await request.json()) as Record<string, unknown>;
	// The client only sends the flag; when it was ticked is recorded here —
	// featured projects are listed in the order they were ticked.
	delete patch.featuredAt;
	if ("images" in patch) patch.images = normalizeGallery(patch.images);
	if ("featured" in patch) {
		patch.featured = patch.featured === true;
		if (patch.featured) {
			if ((await countFeaturedProjects(env.DB, params.id)) >= MAX_FEATURED_PROJECTS) {
				return Response.json(
					{ error: `At most ${MAX_FEATURED_PROJECTS} featured projects. Untick one first.` },
					{ status: 409 },
				);
			}
			const current = (await getProjectById(env.DB, params.id!)) as { featured?: boolean } | null;
			if (!current?.featured) patch.featuredAt = Date.now();
		} else {
			patch.featuredAt = null;
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
