/**
 * Loads the ad / analytics platforms whose IDs are set in the admin
 * (Settings › Marketing & Analytics) — the same official loaders each
 * platform hands out as a pasted snippet, rebuilt here as a bundled module
 * so the Content-Security-Policy never has to allow inline scripts.
 *
 * Two things a pasted snippet gets wrong on this site, handled here:
 * - Page views: pages change without a full reload (Astro's client router),
 *   so a snippet would only ever count the first page of a visit. One page
 *   view goes out per astro:page-load instead, first load included.
 * - Leads: a sent inquiry (the "site:lead" event from inquire.astro) is
 *   reported to every platform as its own lead/conversion event.
 */
import { normalizeMarketing, type MarketingIds } from "../data/marketing";

type Queue = ((...args: unknown[]) => void) & Record<string, any>;

declare global {
	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
		fbq?: Queue;
		_fbq?: Queue;
		ttq?: any;
		TiktokAnalyticsObject?: string;
		_linkedin_partner_id?: string;
		_linkedin_data_partner_ids?: string[];
		lintrk?: Queue;
	}
}

/** Fired by the inquiry form once a message has actually been sent. */
export const LEAD_EVENT = "site:lead";

function loadScript(src: string) {
	const script = document.createElement("script");
	script.async = true;
	script.src = src;
	// On <html> itself, not <head>/<body>: the client router swaps those on
	// every navigation and would drop a tag that's still downloading.
	document.documentElement.appendChild(script);
}

function readConfig(): MarketingIds | null {
	const el = document.getElementById("marketing-config");
	if (!el?.textContent) return null;
	try {
		const ids = normalizeMarketing(JSON.parse(el.textContent));
		return Object.values(ids).some(Boolean) ? ids : null;
	} catch {
		return null;
	}
}

function initGoogle(ids: MarketingIds) {
	if (!ids.ga4Id && !ids.googleAdsId) return;
	window.dataLayer = window.dataLayer || [];
	window.gtag = function gtag() {
		// gtag.js reads the `arguments` object itself, not an array copy.
		// eslint-disable-next-line prefer-rest-params
		window.dataLayer!.push(arguments);
	};
	window.gtag("js", new Date());
	// Page views are sent by hand on every page load (see trackPageView).
	if (ids.ga4Id) window.gtag("config", ids.ga4Id, { send_page_view: false });
	if (ids.googleAdsId) window.gtag("config", ids.googleAdsId, { send_page_view: false });
	loadScript(`https://www.googletagmanager.com/gtag/js?id=${ids.ga4Id || ids.googleAdsId}`);
}

function initMeta(ids: MarketingIds) {
	if (!ids.metaPixelId || window.fbq) return;
	const fbq = function (...args: unknown[]) {
		if (fbq.callMethod) fbq.callMethod(...args);
		else fbq.queue.push(args);
	} as Queue;
	fbq.push = fbq;
	fbq.loaded = true;
	fbq.version = "2.0";
	fbq.queue = [];
	window.fbq = window._fbq = fbq;
	loadScript("https://connect.facebook.net/en_US/fbevents.js");
	fbq("init", ids.metaPixelId);
}

function initTikTok(ids: MarketingIds) {
	if (!ids.tiktokPixelId || window.ttq) return;
	const name = "ttq";
	window.TiktokAnalyticsObject = name;
	const ttq: any = (window.ttq = []);
	ttq.methods = [
		"page", "track", "identify", "instances", "debug", "on", "off", "once", "ready",
		"alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent",
	];
	ttq.setAndDefer = (target: any, method: string) => {
		target[method] = (...args: unknown[]) => target.push([method, ...args]);
	};
	ttq.methods.forEach((method: string) => ttq.setAndDefer(ttq, method));
	ttq.instance = (id: string) => {
		const instance = ttq._i[id] || [];
		ttq.methods.forEach((method: string) => ttq.setAndDefer(instance, method));
		return instance;
	};
	ttq.load = (id: string, options?: Record<string, unknown>) => {
		const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
		ttq._i = ttq._i || {};
		ttq._i[id] = [];
		ttq._i[id]._u = url;
		ttq._t = ttq._t || {};
		ttq._t[id] = +new Date();
		ttq._o = ttq._o || {};
		ttq._o[id] = options || {};
		loadScript(`${url}?sdkid=${id}&lib=${name}`);
	};
	ttq.load(ids.tiktokPixelId);
}

function initLinkedIn(ids: MarketingIds) {
	if (!ids.linkedinPartnerId || window.lintrk) return;
	window._linkedin_partner_id = ids.linkedinPartnerId;
	window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
	window._linkedin_data_partner_ids.push(ids.linkedinPartnerId);
	const lintrk = function (a: unknown, b: unknown) {
		lintrk.q.push([a, b]);
	} as Queue;
	lintrk.q = [];
	window.lintrk = lintrk;
	// The Insight Tag sends its own page view on load and follows later
	// URL changes by itself.
	loadScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
}

function trackPageView(ids: MarketingIds) {
	if (window.gtag) {
		window.gtag("event", "page_view", {
			page_location: location.href,
			page_path: location.pathname,
			page_title: document.title,
		});
	}
	if (ids.metaPixelId) window.fbq?.("track", "PageView");
	if (ids.tiktokPixelId) window.ttq?.page();
}

function trackLead(ids: MarketingIds) {
	if (window.gtag) {
		if (ids.ga4Id) window.gtag("event", "generate_lead", { send_to: ids.ga4Id });
		if (ids.googleAdsId && ids.googleAdsLeadLabel) {
			window.gtag("event", "conversion", { send_to: `${ids.googleAdsId}/${ids.googleAdsLeadLabel}` });
		}
	}
	if (ids.metaPixelId) window.fbq?.("track", "Lead");
	if (ids.tiktokPixelId) window.ttq?.track("SubmitForm");
}

/** Runs once per visit (the module is shared by every page). */
export function initMarketing() {
	const ids = readConfig();
	if (!ids) return;
	initGoogle(ids);
	initMeta(ids);
	initTikTok(ids);
	initLinkedIn(ids);
	document.addEventListener("astro:page-load", () => trackPageView(ids));
	document.addEventListener(LEAD_EVENT, () => trackLead(ids));
}
