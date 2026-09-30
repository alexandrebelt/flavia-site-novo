/**
 * Reduces a rendered page to Markdown-ish text. Shared by /llms-full.txt
 * (page-text.ts) and the Accept: text/markdown responses (middleware.ts).
 * Kept free of page imports so the middleware can use it.
 */
const DROPPED_ELEMENTS = /<(script|style|svg|noscript|template|video|button|select|textarea)\b[\s\S]*?<\/\1>/gi;

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	rarr: "→",
	larr: "←",
	middot: "·",
	mdash: "—",
	ndash: "–",
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
		if (code[0] === "#") {
			const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
			return Number.isFinite(value) ? String.fromCodePoint(value) : match;
		}
		return ENTITIES[code.toLowerCase()] ?? match;
	});
}

/** The page's <main> as Markdown-ish text: headings, list items, paragraphs. */
export function htmlToText(html: string): string {
	const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
	const text = main
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(DROPPED_ELEMENTS, "")
		.replace(/<h([1-6])\b[^>]*>/gi, (_, level: string) => `\n\n${"#".repeat(Number(level))} `)
		.replace(/<\/h[1-6]>/gi, "\n\n")
		.replace(/<li\b[^>]*>/gi, "\n- ")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|section|ul|ol|dl|dd|dt|label|legend|fieldset|form)>/gi, "\n")
		.replace(/<[^>]+>/g, " ");

	return decodeEntities(text)
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
