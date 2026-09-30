import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	countFeaturedProjects,
	createProject,
	findConflict,
	listProjects,
} from "../../../lib/server/projects-store.js";
import { buildProjectId, randomIdSuffix, slugify } from "../../../data/project-ids";
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

	// The admin form fills both in, but they're derived here too so a
	// project can never be saved without them (or with unsafe characters).
	project.slug = slugify(String(project.slug || project.client || ""));
	project.id = project.id
		? slugify(String(project.id))
		: buildProjectId(project.slug as string, randomIdSuffix());

	if (!project.client || !project.slug) {
		return Response.json({ error: "Client and slug are required." }, { status: 400 });
	}

	const conflict = await findConflict(env.DB, { id: project.id, slug: project.slug });
	if (conflict) {
		return Response.json(
			{
				error:
					conflict === "slug"
						? `Another project already uses the slug "${project.slug}" — change it.`
						: `Another project already uses the ID "${project.id}" — change it.`,
			},
			{ status: 409 },
		);
	}

	try {
		const created = await createProject(env.DB, project);
		return Response.json(created, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Couldn't create the project.";
		return Response.json({ error: message }, { status: 409 });
	}
};
