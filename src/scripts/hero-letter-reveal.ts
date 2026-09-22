import gsap from "gsap";

/**
 * Splits `el`'s text into `.hero-reveal-word` > `.hero-reveal-letter` spans
 * (styled in main.css with the display/perspective setup that rotateY
 * reveals need) and returns the letter elements. Shared by the hero title
 * reveal below and by any other element that wants the same "letters spin
 * in" effect (e.g. the project grid's per-item title reveal).
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
	if (!h1) return;

	const letters = splitIntoLetterSpans(h1);

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

	// Wrapped in a timeline so onComplete fires once for the whole reveal —
	// a stagger built directly into gsap.fromTo() calls onComplete once per
	// letter (one per generated sub-tween), which would attach the hover
	// listeners once per letter, over and over.
	//
	// transformPerspective is GSAP's own 3D-depth property, baked straight
	// into the matrix3d it generates. The CSS `perspective` property on an
	// ancestor doesn't reach these letters (they're grandchildren: h1 > word
	// > letter) even with preserve-3d on the word wrapper, so without this
	// the rotateY applies but renders flat — no visible turn.
	gsap
		.timeline({ onComplete: enableHoverTilt })
		.fromTo(
			letters,
			{ rotateY: -90, opacity: 0, transformPerspective: 400 },
			{
				rotateY: 0,
				opacity: 1,
				duration: 0.7,
				ease: "power3.out",
				stagger: 0.025,
			},
		);

	// Same fade-in as the homepage hero's subtitle, after the letters reveal.
	gsap.fromTo(
		".hero-reveal-wrapper h6",
		{ opacity: 0 },
		{ opacity: 1, duration: 1, delay: 1 },
	);
}
