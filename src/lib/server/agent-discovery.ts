/**
 * Helps AI agents find and read the public site (see middleware.ts):
 *  - every public HTML page advertises the sitemap and llms.txt in a
 *    `Link` header, so an agent landing on any page can discover them;
 *  - a request that asks for Markdown (`Accept: text/markdown`) gets the
 *    page's text as Markdown instead of the full HTML.
 */
import { htmlToText } from "./html-to-text";

const DISCOVERY_LINKS = [
	'</sitemap.xml>; rel="sitemap"; type="application/xml"',
	'</llms.txt>; rel="describedby"; type="text/plain"',
].join(", ");

/** Admin screens and the API are private — no discovery hints there. */
export function isPublicPage(pathname: string): boolean {
	return !pathname.startsWith("/admin") && !pathname.startsWith("/api/");
}

/**
 * True when the client explicitly asks for Markdown ahead of (or instead
 * of) HTML. Browsers never send text/markdown, so visitors are unaffected.
 */
export function wantsMarkdown(request: Request): boolean {
	if (request.method !== "GET" && request.method !== "HEAD") return false;
	const quality = (type: string) => {
		for (const part of (request.headers.get("Accept") ?? "").split(",")) {
			const [mediaType, ...params] = part.trim().split(";");
			if (mediaType.trim().toLowerCase() !== type) continue;
			const q = params.find((p) => p.trim().startsWith("q="));
			return q ? Number(q.trim().slice(2)) || 0 : 1;
		}
		return -1;
	};
	const markdown = quality("text/markdown");
	return markdown > 0 && markdown >= quality("text/html");
}

function isHtml(response: Response): boolean {
	return (response.headers.get("Content-Type") ?? "").includes("text/html");
}

/** The page as Markdown, headed by its <title>; anything else passes through. */
export async function toMarkdown(response: Response): Promise<Response> {
	if (!response.ok || !isHtml(response)) return response;
	const html = await response.text();
	const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
	const body = htmlToText(html);
	const markdown = title ? `# ${title}\n\n${body}\n` : `${body}\n`;

	const headers = new Headers(response.headers);
	headers.set("Content-Type", "text/markdown; charset=utf-8");
	headers.delete("Content-Length");
	return new Response(markdown, { status: response.status, headers });
}

/** Adds the discovery `Link` header (and `Vary: Accept`) to a public HTML page. */
export function addDiscoveryHeaders(response: Response): void {
	const type = response.headers.get("Content-Type") ?? "";
	if (!type.includes("text/html") && !type.includes("text/markdown")) return;
	response.headers.append("Link", DISCOVERY_LINKS);
	// The same URL answers with HTML or Markdown depending on Accept.
	response.headers.append("Vary", "Accept");
}
