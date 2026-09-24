import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { consumeInquiryQuota } from "../../lib/server/rate-limit.js";
import { verifyTurnstile } from "../../lib/server/turnstile.js";

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

// Hidden field real visitors never see or fill (see inquire.astro). Bots
// that fill every input give themselves away.
const HONEYPOT_FIELD = "company";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FIELD_LENGTH = 5000;
const MAX_SHORT_FIELD_LENGTH = 200;
const MAX_SCOPE_ITEMS = 20;

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

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const apiKey = env.RESEND_API_KEY;
	if (!apiKey) {
		console.error("RESEND_API_KEY is not set — inquiry emails cannot be sent.");
		return Response.json(
			{ error: "Inquiries are temporarily unavailable. Please email us directly." },
			{ status: 503 },
		);
	}

	let data: Record<string, unknown>;
	try {
		data = await request.json();
	} catch {
		return Response.json({ error: "Invalid request." }, { status: 400 });
	}

	// Pretend it worked, so the bot has nothing to learn from.
	if (String(data[HONEYPOT_FIELD] ?? "").trim()) {
		return Response.json({ ok: true });
	}

	const ip = request.headers.get("CF-Connecting-IP") || clientAddress || "unknown";

	const human = await verifyTurnstile(env, String(data.turnstileToken ?? ""), ip);
	if (!human) {
		return Response.json(
			{ error: "We couldn't verify your submission. Please try again." },
			{ status: 403 },
		);
	}

	const field = (key: string) => String(data[key] ?? "").trim();
	const fullName = field("fullName");
	const email = field("email");
	if (!fullName || !email) {
		return Response.json({ error: "Name and email are required." }, { status: 400 });
	}
	if (!EMAIL_PATTERN.test(email) || email.length > MAX_SHORT_FIELD_LENGTH) {
		return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
	}
	const tooLong = Object.entries(data).some(
		([, value]) => typeof value === "string" && value.length > MAX_FIELD_LENGTH,
	);
	if (tooLong || fullName.length > MAX_SHORT_FIELD_LENGTH) {
		return Response.json({ error: "One of the fields is too long." }, { status: 400 });
	}

	const scope = Array.isArray(data.scope)
		? data.scope.map(String).filter(Boolean).slice(0, MAX_SCOPE_ITEMS)
		: [];

	// Checked last, so only submissions that would otherwise go out count.
	if (!(await consumeInquiryQuota(env.SESSION, ip))) {
		return Response.json(
			{ error: "Too many inquiries from this connection. Please try again later or email us directly." },
			{ status: 429 },
		);
	}

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
			return Response.json({ error: "We couldn't send your inquiry. Please try again or email us directly." }, { status: 502 });
		}

		await addToInquiriesSegment(resend, fullName, email);

		return Response.json({ ok: true });
	} catch (err) {
		console.error("Inquiry send failed:", err);
		return Response.json({ error: "We couldn't send your inquiry. Please try again or email us directly." }, { status: 500 });
	}
};
