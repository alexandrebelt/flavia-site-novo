import gsap from "gsap";
import { textRevealHidden, textRevealVisible } from "./text-reveal";
import { onPageReady } from "./page-ready";

/**
 * Splits `el`'s text into `.hero-reveal-word` > `.hero-reveal-letter` spans
 * (inline-blocks, see main.css) and returns the letter elements. Shared by
 * the hero title reveal below and by every other letter-by-letter reveal —
 * how those letters appear (blur + fade) is set in text-reveal.ts.
 */
export function splitIntoLetterSpans(el: HTMLElement): HTMLElement[] {
	const text = el.textContent?.trim() || "";
	el.textContent = "";
	el.setAttribute("aria-label", text);

	text.split(" ").forEach((word, i, words) => {
		const wordEl = document.createElement("span");
		wordEl.className = "hero-reveal-word";
		[...word].forEach((char) => {
			const letterEl = document.createElement("span");
			letterEl.className = "hero-reveal-letter";
			letterEl.textContent = char;
			letterEl.setAttribute("aria-hidden", "true");
			wordEl.appendChild(letterEl);
		});
		el.appendChild(wordEl);
		if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
	});

	return Array.from(el.querySelectorAll<HTMLElement>(".hero-reveal-letter"));
}

/**
 * Same letter-spin split as splitIntoLetterSpans, but walks `el`'s child
 * nodes instead of flattening textContent — needed for headings with inline
 * markup inside them (an <i>, a <br>, ...), where a flatten-then-split would
 * silently drop that markup.
 */
export function splitPreservingMarkup(el: HTMLElement): HTMLElement[] {
	const letters: HTMLElement[] = [];

	function splitNode(node: ChildNode) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent || "";
			const fragment = document.createDocumentFragment();
			text.split(" ").forEach((word, i, words) => {
				const wordEl = document.createElement("span");
				wordEl.className = "hero-reveal-word";
				[...word].forEach((char) => {
					const letterEl = document.createElement("span");
					letterEl.className = "hero-reveal-letter";
					letterEl.textContent = char;
					letterEl.setAttribute("aria-hidden", "true");
					wordEl.appendChild(letterEl);
					letters.push(letterEl);
				});
				fragment.appendChild(wordEl);
				if (i < words.length - 1) fragment.appendChild(document.createTextNode(" "));
			});
			node.replaceWith(fragment);
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			Array.from(node.childNodes).forEach(splitNode);
		}
	}

	el.setAttribute("aria-label", el.textContent?.trim() || "");
	Array.from(el.childNodes).forEach(splitNode);
	return letters;
}

/**
 * Splits the first <h1> inside .hero-reveal-wrapper into per-letter spans,
 * reveals them in sequence with GSAP, then wires up a per-letter hover tilt.
 * Shared by every page that uses the .hero-reveal-wrapper hero pattern
 * (services, inquire, ...) so the fixes baked in here (scoped-style,
 * perspective, onComplete-per-tween) only have to exist once.
 */
export function playHeroLetterReveal() {
	const h1 = document.querySelector<HTMLElement>(".hero-reveal-wrapper h1");
	const subtext = document.querySelector<HTMLElement>(".hero-reveal-wrapper h6");
	// Both services and inquire register this on astro:page-load, so once
	// both pages have been visited it runs twice per navigation — only the
	// first call may split and animate this h1.
	if (!h1 || h1.dataset.heroRevealBound) return;
	h1.dataset.heroRevealBound = "true";

	const letters = splitIntoLetterSpans(h1);

	// Hidden immediately (not deferred below) so nothing flashes fully
	// visible while waiting for the page-entrance transition to finish.
	gsap.set(letters, textRevealHidden());
	if (subtext) gsap.set(subtext, textRevealHidden());

	function enableHoverTilt() {
		letters.forEach((letter) => {
			letter.addEventListener("mouseenter", () => {
				gsap.killTweensOf(letter);
				gsap
					.timeline()
					.to(letter, {
						rotateY: -14,
						transformPerspective: 400,
						duration: 0.18,
						ease: "power2.out",
					})
					.to(letter, { rotateY: 0, duration: 0.4, ease: "back.out(2.5)" });
			});
		});
	}

	// Waits for the page-entrance transition to actually finish (see
	// Layout.astro) — running immediately on astro:page-load instead would
	// play this out mostly hidden during the fade, finished (or nearly so)
	// by the time the page is actually visible, for any hero short enough
	// that its reveal fits inside the transition's own duration.
	onPageReady(() => {
		// Wrapped in a timeline so onComplete fires once for the whole
		// reveal — a stagger built directly into gsap.fromTo() calls
		// onComplete once per letter (one per generated sub-tween), which
		// would attach the hover listeners once per letter, over and over.
		gsap.timeline({ onComplete: enableHoverTilt }).to(letters, {
			...textRevealVisible,
			duration: 0.7,
			ease: "power3.out",
			stagger: 0.025,
		});

		// Same fade-in as the homepage hero's subtitle, after the letters
		// reveal.
		if (subtext) {
			gsap.to(subtext, { ...textRevealVisible, duration: 1, delay: 1 });
		}
	});
}
