import sanitizeHtml from "sanitize-html";

/**
 * Cleans the inline HTML the admin's rich-text block editor produces before
 * it's written to the projects table. Only inline formatting is allowed — no
 * block tags, scripts, styles or event handlers — since each entry is one
 * block's text, not a full document.
 */
export function sanitizeRichText(html) {
	return sanitizeHtml(html, {
		allowedTags: ["b", "strong", "i", "em", "u", "a", "br"],
		allowedAttributes: { a: ["href", "target", "rel"] },
		allowedSchemes: ["http", "https", "mailto"],
		transformTags: {
			a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
		},
	}).trim();
}
