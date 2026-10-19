/**
 * Ad / analytics tags (admin › Settings › Marketing & Analytics). The admin
 * only enters each platform's ID; the site loads the official script itself
 * (scripts/marketing.ts) — no pasted code, so the Content-Security-Policy
 * stays strict and only opens the domains of the platforms actually set.
 *
 * Shared by the admin form (checks before saving), the settings API
 * (re-checks and drops anything else) and the middleware (CSP).
 */

export interface MarketingIds {
	ga4Id: string;
	googleAdsId: string;
	googleAdsLeadLabel: string;
	metaPixelId: string;
	tiktokPixelId: string;
	linkedinPartnerId: string;
}

export type MarketingKey = keyof MarketingIds;

export const MARKETING_FIELDS: readonly {
	key: MarketingKey;
	label: string;
	placeholder: string;
	hint: string;
	pattern: RegExp;
}[] = [
	{
		key: "ga4Id",
		label: "Google Analytics 4 — Measurement ID",
		placeholder: "G-XXXXXXXXXX",
		hint: "Google Analytics › Admin › Data streams › your site.",
		pattern: /^G-[A-Z0-9]{4,20}$/,
	},
	{
		key: "googleAdsId",
		label: "Google Ads — Conversion ID",
		placeholder: "AW-123456789",
		hint: "Google Ads › Goals › Conversions › Tag setup (the AW-… part).",
		pattern: /^AW-\d{6,15}$/,
	},
	{
		key: "googleAdsLeadLabel",
		label: "Google Ads — Lead conversion label (optional)",
		placeholder: "AbC-D_efG-h12_34-567",
		hint: "The part after the slash in send_to: 'AW-123456789/AbC…'. Counts each inquiry sent as a Google Ads conversion.",
		pattern: /^[A-Za-z0-9_-]{4,40}$/,
	},
	{
		key: "metaPixelId",
		label: "Meta Pixel ID (Facebook / Instagram)",
		placeholder: "1234567890123456",
		hint: "Meta Events Manager › Data sources › your pixel (numbers only).",
		pattern: /^\d{8,20}$/,
	},
	{
		key: "tiktokPixelId",
		label: "TikTok Pixel ID",
		placeholder: "CXXXXXXXXXXXXXXXXXXX",
		hint: "TikTok Ads Manager › Assets › Events › your pixel.",
		pattern: /^[A-Z0-9]{10,30}$/,
	},
	{
		key: "linkedinPartnerId",
		label: "LinkedIn Insight Tag — Partner ID",
		placeholder: "1234567",
		hint: "LinkedIn Campaign Manager › Analyze › Insight Tag.",
		pattern: /^\d{4,12}$/,
	},
];

export const EMPTY_MARKETING: MarketingIds = {
	ga4Id: "",
	googleAdsId: "",
	googleAdsLeadLabel: "",
	metaPixelId: "",
	tiktokPixelId: "",
	linkedinPartnerId: "",
};

export function isValidMarketingId(key: MarketingKey, value: string): boolean {
	const field = MARKETING_FIELDS.find((f) => f.key === key);
	return !!field && field.pattern.test(value);
}

/** Only known keys; each one blank or matching its platform's format. */
export function normalizeMarketing(value: unknown): MarketingIds {
	const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	const out = { ...EMPTY_MARKETING };
	for (const { key } of MARKETING_FIELDS) {
		const raw = typeof input[key] === "string" ? (input[key] as string).trim() : "";
		out[key] = raw && isValidMarketingId(key, raw) ? raw : "";
	}
	return out;
}

/** The keys that were filled in but don't match their format. */
export function invalidMarketingKeys(value: unknown): MarketingKey[] {
	const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	return MARKETING_FIELDS.filter(({ key }) => {
		const raw = typeof input[key] === "string" ? (input[key] as string).trim() : "";
		return raw !== "" && !isValidMarketingId(key, raw);
	}).map(({ key }) => key);
}

type CspDirective = "script-src" | "connect-src" | "img-src" | "frame-src";

/**
 * Extra Content-Security-Policy sources for the platforms that are set —
 * nothing at all when none are. Images from any https origin are allowed
 * once any platform is on: Google Ads' remarketing pixels come from
 * country-specific google.<tld> domains, and an image can't run code.
 */
export function marketingCspSources(ids: MarketingIds): Record<CspDirective, string[]> {
	const sources: Record<CspDirective, Set<string>> = {
		"script-src": new Set(),
		"connect-src": new Set(),
		"img-src": new Set(),
		"frame-src": new Set(),
	};
	const add = (directive: CspDirective, ...values: string[]) =>
		values.forEach((v) => sources[directive].add(v));

	if (ids.ga4Id || ids.googleAdsId) {
		// Google's published CSP list for GA4 + Ads (remarketing/conversions).
		add(
			"script-src",
			"https://www.googletagmanager.com",
			"https://www.googleadservices.com",
			"https://googleads.g.doubleclick.net",
			"https://www.google.com",
		);
		add(
			"connect-src",
			"https://*.google-analytics.com",
			"https://*.analytics.google.com",
			"https://*.googletagmanager.com",
			"https://*.doubleclick.net",
			"https://www.google.com",
			"https://google.com",
			// Regional copy of the conversion ping, for visitors in Brazil.
			"https://www.google.com.br",
			"https://www.googleadservices.com",
			"https://pagead2.googlesyndication.com",
		);
		add("frame-src", "https://td.doubleclick.net", "https://www.googletagmanager.com");
	}
	if (ids.metaPixelId) {
		add("script-src", "https://connect.facebook.net");
		add("connect-src", "https://www.facebook.com", "https://connect.facebook.net");
	}
	if (ids.tiktokPixelId) {
		add("script-src", "https://analytics.tiktok.com");
		add("connect-src", "https://analytics.tiktok.com", "https://*.tiktok.com", "https://*.tiktokw.us");
	}
	if (ids.linkedinPartnerId) {
		add("script-src", "https://snap.licdn.com");
		add("connect-src", "https://px.ads.linkedin.com", "https://*.linkedin.com");
	}
	if (Object.values(ids).some(Boolean)) add("img-src", "https:");

	return {
		"script-src": [...sources["script-src"]],
		"connect-src": [...sources["connect-src"]],
		"img-src": [...sources["img-src"]],
		"frame-src": [...sources["frame-src"]],
	};
}
