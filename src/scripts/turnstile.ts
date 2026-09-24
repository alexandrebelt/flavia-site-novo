/**
 * Cloudflare Turnstile, invisible mode: the widget runs its checks in the
 * background and only ever shows itself if Cloudflare needs the visitor to
 * interact (rare). The token it produces is sent with the form and checked
 * server-side (lib/server/turnstile.js).
 */
interface TurnstileApi {
	render(container: HTMLElement, options: Record<string, unknown>): string;
	reset(widgetId: string): void;
	remove(widgetId: string): void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Loaded once per session, on the first page that needs it.
let apiPromise: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
	apiPromise ??= new Promise((resolve, reject) => {
		if (window.turnstile) return resolve(window.turnstile);
		const script = document.createElement("script");
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () =>
			window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable"));
		script.onerror = () => {
			apiPromise = undefined;
			reject(new Error("Turnstile failed to load"));
		};
		document.head.appendChild(script);
	});
	return apiPromise;
}

export interface TurnstileWidget {
	/** Resolves with a fresh token, waiting for the background check if needed ("" if it never completes). */
	getToken(timeoutMs?: number): Promise<string>;
	/** Tokens are single-use: call after every submission attempt. */
	reset(): void;
	remove(): void;
}

export function mountTurnstile(container: HTMLElement, siteKey: string): TurnstileWidget {
	let widgetId: string | undefined;
	let token = "";
	let waiters: Array<(value: string) => void> = [];

	const settle = (value: string) => {
		token = value;
		if (!value) return;
		waiters.forEach((resolve) => resolve(value));
		waiters = [];
	};

	const ready = loadTurnstile()
		.then((api) => {
			widgetId = api.render(container, {
				sitekey: siteKey,
				appearance: "interaction-only",
				callback: settle,
				"expired-callback": () => settle(""),
				"error-callback": () => settle(""),
			});
			return api;
		})
		.catch((err) => {
			console.error(err);
			return undefined;
		});

	return {
		async getToken(timeoutMs = 15000) {
			await ready;
			if (token) return token;
			return new Promise((resolve) => {
				waiters.push(resolve);
				setTimeout(() => resolve(token), timeoutMs);
			});
		},
		reset() {
			token = "";
			ready.then((api) => api && widgetId && api.reset(widgetId));
		},
		remove() {
			ready.then((api) => api && widgetId && api.remove(widgetId));
		},
	};
}
