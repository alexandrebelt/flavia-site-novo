/**
 * Open/close state of the header's fullscreen menu (Header.astro). Shared
 * with Layout.astro's page transition, which has to let the menu finish
 * sliding away before it fades the page out.
 *
 * Always acts on whichever header is currently in the DOM — every SPA
 * navigation swaps in a fresh one, so nothing here may hold on to the
 * previous page's elements.
 */
export function setMenuOpen(open: boolean) {
	const btn = document.querySelector<HTMLButtonElement>(".btn-menu");
	const menu = document.querySelector<HTMLElement>(".menu-content");
	if (!btn || !menu) return;
	menu.classList.toggle("active-menu", open);
	btn.classList.toggle("active-btn", open);
	btn.setAttribute("aria-expanded", String(open));
	document.body.classList.toggle("menu-open", open);
}

export function isMenuOpen(): boolean {
	return !!document.querySelector(".menu-content.active-menu");
}

/**
 * Closes the menu and resolves once its slide-out has finished (or right
 * away if it wasn't open). The fallback timeout covers a transitionend
 * that never fires (reduced motion, tab in the background).
 */
export function closeMenuAndWait(): Promise<void> {
	const menu = document.querySelector<HTMLElement>(".menu-content");
	if (!menu || !isMenuOpen()) return Promise.resolve();

	const durationMs =
		parseFloat(getComputedStyle(menu).transitionDuration) * 1000 || 0;

	return new Promise((resolve) => {
		const done = () => {
			clearTimeout(fallback);
			menu.removeEventListener("transitionend", onEnd);
			resolve();
		};
		const onEnd = (e: TransitionEvent) => {
			if (e.target === menu && e.propertyName === "transform") done();
		};
		const fallback = setTimeout(done, durationMs + 100);
		menu.addEventListener("transitionend", onEnd);
		setMenuOpen(false);
	});
}
