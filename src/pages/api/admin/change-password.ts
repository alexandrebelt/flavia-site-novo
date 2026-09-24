import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getUserById, updateUserPassword } from "../../../lib/server/users-store.js";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../../../lib/server/auth.js";
import { deleteAllSessions } from "../../../lib/server/session.js";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
	const session = locals.user;
	if (!session) {
		return Response.json({ error: "Not authenticated." }, { status: 401 });
	}

	let body: { currentPassword?: string; newPassword?: string };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid request." }, { status: 400 });
	}

	const currentPassword = body.currentPassword || "";
	const newPassword = body.newPassword || "";

	const user = await getUserById(env.DB, session.userId);
	if (!user) {
		return Response.json({ error: "User not found." }, { status: 404 });
	}

	const isValid = await verifyPassword(currentPassword, user.password_hash as string);
	if (!isValid) {
		return Response.json({ error: "Current password is incorrect." }, { status: 401 });
	}

	const { valid, reasons } = validatePasswordStrength(newPassword);
	if (!valid) {
		return Response.json(
			{ error: `The new password needs: ${reasons.join(", ")}.` },
			{ status: 400 },
		);
	}

	const newHash = await hashPassword(newPassword);
	await updateUserPassword(env.DB, user.id as string, newHash);
	// Force every session (including this one) to log in again with the
	// new password — there's only one admin, so this can't lock anyone else out.
	await deleteAllSessions(env.SESSION);

	return Response.json({ ok: true });
};
