import type { APIRoute } from "astro";
import { getSettings, updateSettings } from "../../../lib/server/settings-store.js";

export const prerender = false;

export const GET: APIRoute = async () => {
	const settings = await getSettings();
	return Response.json(settings);
};

export const POST: APIRoute = async ({ request }) => {
	const patch = await request.json();
	const settings = await updateSettings(patch);
	return Response.json(settings);
};
