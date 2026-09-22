/**
 * Runs `callback` only once the page's layout has actually settled —
 * `window.load` (images, video, fonts) plus a fixed extra wait for
 * everything above (pinned sections' spacers, etc.) to finish resolving
 * their final height.
 *
 * Creating a ScrollTrigger (especially with a percentage-based `start`, or
 * right after another pinned section above it) before that point measures
 * a layout that's still shifting — the trigger's start/end pixel positions
 * get baked in wrong, and `ScrollTrigger.refresh()` afterwards does not
 * correct them. Every reveal below the very first section on a page should
 * create its ScrollTrigger through this instead of running immediately.
 */
export function whenPageSettled(callback: () => void, delay = 700) {
	const run = () => setTimeout(() => requestAnimationFrame(callback), delay);
	if (document.readyState === "complete") {
		run();
	} else {
		window.addEventListener("load", run, { once: true });
	}
}
