/**
 * Client testimonials (admin › Testimonials), shown in the home page's
 * index-section-6. Stored in settings as one list; its order is the order
 * they're shown in, and only `visible` ones appear on the site.
 */
export interface Testimonial {
	id: string;
	/** Goes in the h6, before the comma. */
	client: string;
	/** Goes in the h6, after the comma. */
	company: string;
	/** Goes in the h5 — typed without quotation marks; the site adds them. */
	quote: string;
	visible: boolean;
}

const MAX_ITEMS = 50;
const MAX_NAME_LENGTH = 150;
const MAX_QUOTE_LENGTH = 1500;

/** "Client, Company" — or just whichever of the two is filled in. */
export function testimonialAttribution({ client, company }: Pick<Testimonial, "client" | "company">): string {
	return [client, company].filter(Boolean).join(", ");
}

// Straight or curly quotation marks typed around the text are dropped —
// the site wraps every quote in its own “ ” marks.
const WRAPPING_QUOTES = /^["“”'‘’]+|["“”'‘’]+$/g;

function text(value: unknown, max: number): string {
	return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Anything stored or sent by the admin → a clean list (a quote is required). */
export function normalizeTestimonials(value: unknown): Testimonial[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const items: Testimonial[] = [];
	for (const raw of value) {
		if (!raw || typeof raw !== "object") continue;
		const record = raw as Record<string, unknown>;
		const quote = text(record.quote, MAX_QUOTE_LENGTH).replace(WRAPPING_QUOTES, "").trim();
		if (!quote) continue;
		let id = text(record.id, 64).replace(/[^\w-]/g, "");
		if (!id || seen.has(id)) id = `t-${Date.now().toString(36)}-${items.length}`;
		seen.add(id);
		items.push({
			id,
			client: text(record.client, MAX_NAME_LENGTH),
			company: text(record.company, MAX_NAME_LENGTH),
			quote,
			visible: record.visible !== false,
		});
		if (items.length >= MAX_ITEMS) break;
	}
	return items;
}
