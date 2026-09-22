import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	deleteProject,
	getProjectById,
	updateProject,
} from "../../../../lib/server/projects-store.js";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const project = await getProjectById(env.DB, params.id!);
	if (!project) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
	return Response.json(project);
};

export const PUT: APIRoute = async ({ params, request }) => {
	const patch = await request.json();
	const updated = await updateProject(env.DB, params.id!, patch);
	if (!updated) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
	return Response.json(updated);
};

export const DELETE: APIRoute = async ({ params }) => {
	const ok = await deleteProject(env.DB, params.id!);
	if (!ok) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
	return new Response(null, { status: 204 });
};
