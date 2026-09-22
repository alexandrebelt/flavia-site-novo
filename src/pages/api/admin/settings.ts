import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSettings, updateSettings } from "../../../lib/server/settings-store.js";

export const prerender = false;

export const GET: APIRoute = async () => {
	const settings = await getSettings(env.DB);
	return Response.json(settings);
};

export const POST: APIRoute = async ({ request }) => {
	const patch = await request.json();
	const settings = await updateSettings(env.DB, patch);
	return Response.json(settings);
};
