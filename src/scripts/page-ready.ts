/**
 * Runs `callback` once the current page's entrance transition has finished
 * (see Layout.astro's astro:page-ready) — or right away if it already has.
 *
 * A plain `addEventListener("astro:page-ready")` misses the event whenever
 * it's registered after Layout dispatched it: on the very first hard load
 * Layout fires it synchronously inside its own astro:page-load handler,
 * which can run before a page's handler gets the chance to listen — the
 * hero then stays hidden forever. The `data-page-ready` flag Layout sets
 * alongside the event closes that gap.
 */
export function onPageReady(callback: () => void) {
	if (document.documentElement.dataset.pageReady === "true") {
		callback();
		return;
	}
	document.addEventListener("astro:page-ready", callback, { once: true });
}
