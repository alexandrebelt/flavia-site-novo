import { ScrollTrigger } from "gsap/ScrollTrigger";

// Bumped on every navigation, so a whenPageSettled callback queued by the
// previous page can tell it's stale (see below).
let navigationId = 0;
document.addEventListener("astro:before-swap", () => {
	navigationId++;
});

let refreshRaf = 0;

/**
 * Re-sorts every ScrollTrigger into document order, then recalculates them.
 *
 * ScrollTrigger refreshes triggers in creation order, and a pin's spacer
 * only shifts the triggers refreshed after it. Anything created out of
 * order — the persistent footer's trigger (created once, on the first page
 * ever loaded), or a pinned section rebuilt after the admin text arrives —
 * otherwise keeps a start/end position that ignores the pins above it, and
 * fires way before (or after) it's actually on screen. Batched to one run
 * per frame since several reveals usually settle at once.
 */
export function refreshScrollTriggers() {
	if (refreshRaf) return;
	refreshRaf = requestAnimationFrame(() => {
		refreshRaf = 0;
		ScrollTrigger.sort();
		ScrollTrigger.refresh();
	});
}

/**
 * Runs `callback` only once the page's layout has actually settled —
 * `window.load` (images, video, fonts) plus a fixed extra wait for
 * everything above (pinned sections' spacers, etc.) to finish resolving
 * their final height.
 *
 * Creating a ScrollTrigger (especially with a percentage-based `start`, or
 * right after another pinned section above it) before that point measures
 * a layout that's still shifting — the trigger's start/end pixel positions
 * get baked in wrong. Every reveal below the very first section on a page
 * should create its ScrollTrigger through this instead of running
 * immediately.
 *
 * If the visitor navigates away before the wait is over, the callback is
 * dropped: that page's astro:before-swap cleanup has already run, so any
 * trigger it created now would point at detached elements and never be
 * killed.
 */
export function whenPageSettled(callback: () => void, delay = 700) {
	const scheduledFor = navigationId;
	const run = () =>
		setTimeout(
			() =>
				requestAnimationFrame(() => {
					if (scheduledFor !== navigationId) return;
					callback();
					refreshScrollTriggers();
				}),
			delay,
		);
	if (document.readyState === "complete") {
		run();
	} else {
		window.addEventListener("load", run, { once: true });
	}
}
