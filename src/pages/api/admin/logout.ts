import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { deleteSession } from "../../../lib/server/session.js";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
	const token = cookies.get("admin_session")?.value;
	await deleteSession(env.SESSION, token);
	cookies.delete("admin_session", { path: "/" });
	return Response.json({ ok: true });
};
