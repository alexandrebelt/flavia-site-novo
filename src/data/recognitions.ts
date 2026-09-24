/**
 * The About page's "Selected Recognition" list (admin › About). Each item
 * is its text plus an optional link. Older saves stored plain strings; those
 * still read fine as an item without a link.
 */
export interface Recognition {
	text: string;
	/** Empty when the item isn't a link. */
	url: string;
}

const MAX_ITEMS = 50;
const MAX_TEXT_LENGTH = 300;

/** Only real web links — never javascript:, data: and the like. */
export function isValidRecognitionUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
}

/**
 * Whatever is stored (strings, objects, junk) → a clean list: text trimmed
 * and required, links kept only when valid.
 */
export function normalizeRecognitions(value: unknown): Recognition[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item): Recognition => {
			if (typeof item === "string") return { text: item.trim(), url: "" };
			const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
			const text = typeof record.text === "string" ? record.text.trim() : "";
			const url = typeof record.url === "string" ? record.url.trim() : "";
			return { text, url: url && isValidRecognitionUrl(url) ? url : "" };
		})
		.filter((item) => item.text)
		.map((item) => ({ ...item, text: item.text.slice(0, MAX_TEXT_LENGTH) }))
		.slice(0, MAX_ITEMS);
}
