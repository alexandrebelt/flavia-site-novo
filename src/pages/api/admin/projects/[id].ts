import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	countFeaturedProjects,
	deleteProject,
	findConflict,
	getProjectById,
	updateProject,
} from "../../../../lib/server/projects-store.js";
import { getSettings, updateSettings } from "../../../../lib/server/settings-store.js";
import { slugify } from "../../../../data/project-ids";
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
	if ("slug" in patch) {
		patch.slug = slugify(String(patch.slug ?? ""));
		if (!patch.slug) return Response.json({ error: "The slug can't be empty." }, { status: 400 });
	}
	// The ID is normally fixed; the admin can unlock and change it.
	// An unchanged id is kept as-is (older ids may not be slug-shaped).
	if ("id" in patch && patch.id !== params.id) {
		patch.id = slugify(String(patch.id ?? "")) || params.id;
	}
	const renaming = typeof patch.id === "string" && patch.id !== params.id;
	const conflict = await findConflict(
		env.DB,
		{ id: renaming ? (patch.id as string) : undefined, slug: patch.slug as string | undefined },
		params.id,
	);
	if (conflict) {
		return Response.json(
			{
				error:
					conflict === "slug"
						? `Another project already uses the slug "${patch.slug}" — change it.`
						: `Another project already uses the ID "${patch.id}" — change it.`,
			},
			{ status: 409 },
		);
	}

	const updated = await updateProject(env.DB, params.id!, patch);
	if (!updated) return Response.json({ error: "Project not found." }, { status: 404 });

	// The custom project order lists ids — keep this project in its place.
	if (renaming) {
		const settings = await getSettings(env.DB);
		const customOrder = settings.projects?.customOrder;
		if (Array.isArray(customOrder) && customOrder.includes(params.id)) {
			await updateSettings(env.DB, {
				projects: { customOrder: customOrder.map((id: string) => (id === params.id ? patch.id : id)) },
			});
		}
	}
	return Response.json(updated);
};

export const DELETE: APIRoute = async ({ params }) => {
	const ok = await deleteProject(env.DB, params.id!);
	if (!ok) return Response.json({ error: "Project not found." }, { status: 404 });
	return new Response(null, { status: 204 });
};
