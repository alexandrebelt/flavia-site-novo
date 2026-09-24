/**
 * THE one place to tune how things appear on the site.
 *
 * Every fade-in — letter-by-letter titles (page heroes, the home hero
 * letters, the achievements line, testimonials, headings, project titles)
 * and whole blocks (columns, paragraphs, images, the footer, buttons, the
 * Services cover carousel) — starts from `hidden` and animates to
 * `visible`: fading in while the blur clears up. Testimonials also leave
 * the same way. Change a value here — e.g. blur "30px" → "20px" — and it
 * changes everywhere.
 *
 * (Timing — duration, stagger — stays with each animation, since a hero
 * title and a scroll-linked heading need different pacing.)
 */
export const TEXT_REVEAL = {
	/** How blurred each letter starts out. */
	blur: "10px",
	/** How transparent each letter starts out (0 = invisible). */
	opacity: 0,
};

/** Starting state — what gsap.set() puts letters in before they reveal. */
export function textRevealHidden() {
	return { opacity: TEXT_REVEAL.opacity, filter: `blur(${TEXT_REVEAL.blur})` };
}

/** End state — sharp and fully visible. */
export const textRevealVisible = { opacity: 1, filter: "blur(0px)" };
