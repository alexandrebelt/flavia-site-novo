import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";

export const prerender = false;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function row(label: string, value: string): string {
	if (!value) return "";
	return `<tr><td style="padding:6px 12px 6px 0;color:#6d6d6d;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`;
}

const INQUIRIES_SEGMENT_NAME = "Inquires";

// Best-effort: adds the inquirer to the "Inquires" segment in Resend (a
// contact list, distinct from the notification email above), creating that
// segment on first use if it doesn't exist yet. This never fails the
// request — a broken segment/contact call shouldn't stop the studio from
// getting notified, which is the part that actually matters.
async function addToInquiriesSegment(resend: Resend, fullName: string, email: string) {
	try {
		const { data: segments, error: listError } = await resend.segments.list();
		if (listError) throw listError;

		let segmentId = segments?.data.find(
			(s) => s.name.toLowerCase() === INQUIRIES_SEGMENT_NAME.toLowerCase(),
		)?.id;

		if (!segmentId) {
			const { data: created, error: createError } = await resend.segments.create({
				name: INQUIRIES_SEGMENT_NAME,
			});
			if (createError || !created) throw createError ?? new Error("No segment returned");
			segmentId = created.id;
		}

		const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
		const lastName = rest.join(" ") || undefined;

		const { error: contactError } = await resend.contacts.create({
			email,
			firstName,
			lastName,
			segments: [{ id: segmentId }],
		});
		if (contactError) throw contactError;
	} catch (err) {
		console.error("Failed to add inquiry contact to Resend segment:", err);
	}
}

export const POST: APIRoute = async ({ request }) => {
	const apiKey = env.RESEND_API_KEY;
	if (!apiKey) {
		return Response.json(
			{ error: "O envio de inquiries ainda não foi configurado (falta RESEND_API_KEY)." },
			{ status: 503 },
		);
	}

	let data: Record<string, unknown>;
	try {
		data = await request.json();
	} catch {
		return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
	}

	const fullName = String(data.fullName ?? "").trim();
	const email = String(data.email ?? "").trim();
	if (!fullName || !email) {
		return Response.json({ error: "Nome e email são obrigatórios." }, { status: 400 });
	}

	const scope = Array.isArray(data.scope) ? data.scope.map(String).filter(Boolean) : [];
	const field = (key: string) => String(data[key] ?? "").trim();

	const resend = new Resend(apiKey);
	const fromAddress = env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
	const toAddress = env.INQUIRY_TO_EMAIL || "studio@flaviajackeline.com";

	const html = `
		<div style="font-family: sans-serif; font-size: 14px; color: #0e0e0e;">
			<h2 style="font-weight: 500;">New project inquiry</h2>
			<table cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
				${row("Full Name", fullName)}
				${row("Location | Country", field("location"))}
				${row("Email", email)}
				${row("Phone", field("phone"))}
				${row("Website | Instagram", field("website"))}
				${row("Found studio via", field("foundStudio"))}
				${row("Preferred proposal method", field("proposalMethod"))}
				${row("Scope", scope.join(", "))}
				${row("Business | Brand Name", field("business"))}
				${row("What the business does", field("businessDescription"))}
				${row("Project Type", field("projectType"))}
				${row("Launch timing", field("launchTiming"))}
				${row("Investment range", field("investmentRange"))}
				${row("Project details", field("projectDetails"))}
			</table>
		</div>
	`;

	try {
		const { error } = await resend.emails.send({
			from: fromAddress,
			to: toAddress,
			replyTo: email,
			subject: `New inquiry from ${fullName}`,
			html,
		});

		if (error) {
			console.error("Resend error:", error);
			return Response.json({ error: "Falha ao enviar o email." }, { status: 502 });
		}

		await addToInquiriesSegment(resend, fullName, email);

		return Response.json({ ok: true });
	} catch (err) {
		console.error("Inquiry send failed:", err);
		return Response.json({ error: "Falha ao enviar o email." }, { status: 500 });
	}
};
