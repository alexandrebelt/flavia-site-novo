import gsap from "gsap";

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

	const text = h1.textContent?.trim() || "";
	h1.textContent = "";
	h1.setAttribute("aria-label", text);

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
		h1.appendChild(wordEl);
		if (i < words.length - 1) h1.appendChild(document.createTextNode(" "));
	});

	const letters = h1.querySelectorAll<HTMLElement>(".hero-reveal-letter");

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
}
