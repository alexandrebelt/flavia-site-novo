/**
 * Social networks linked from the footer's "Connect" column and the About
 * page's contact row. Their URLs are set in the admin (Configurações › SEO)
 * and stored under settings.seo.socialLinks; any left blank (or invalid)
 * falls back to the network's own homepage.
 */
export const SOCIAL_NETWORKS = [
	{
		key: "instagram",
		label: "Instagram",
		defaultUrl: "https://instagram.com/",
		hosts: ["instagram.com"],
	},
	{
		key: "behance",
		label: "Behance",
		defaultUrl: "https://behance.net/",
		hosts: ["behance.net"],
	},
	{
		key: "linkedin",
		label: "LinkedIn",
		defaultUrl: "https://linkedin.com/",
		hosts: ["linkedin.com"],
	},
	{
		key: "pinterest",
		label: "Pinterest",
		defaultUrl: "https://pinterest.com/",
		// Pinterest serves profiles from country domains too (pinterest.com.br, .co.uk, ...).
		hosts: ["pinterest.com", "pinterest.com.br", "pinterest.co.uk", "pin.it"],
	},
	{
		key: "x",
		label: "X",
		defaultUrl: "https://x.com/",
		hosts: ["x.com", "twitter.com"],
	},
] as const;

export type SocialKey = (typeof SOCIAL_NETWORKS)[number]["key"];
export type SocialLinks = Partial<Record<SocialKey, string>>;

/**
 * An http(s) URL on the network's own domain (or a subdomain of it, e.g.
 * br.linkedin.com). Anything else — a typo, another site, a `javascript:`
 * URL — is rejected, both when the admin saves and when a page renders.
 */
export function isValidSocialUrl(key: SocialKey, value: string): boolean {
	const network = SOCIAL_NETWORKS.find((n) => n.key === key);
	if (!network) return false;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return false;
	const host = url.hostname.toLowerCase();
	return network.hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

export function resolveSocialUrl(key: SocialKey, links: SocialLinks | undefined): string {
	const custom = links?.[key]?.trim();
	if (custom && isValidSocialUrl(key, custom)) return custom;
	return SOCIAL_NETWORKS.find((network) => network.key === key)?.defaultUrl ?? "/";
}
