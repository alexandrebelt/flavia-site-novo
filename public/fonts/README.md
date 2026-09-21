# Fonts

Self-hosted webfont files (`.woff2`, `.woff`) go here.

Files in `public/` are served as-is at the site root, so a file at
`public/fonts/my-font.woff2` is available at `/fonts/my-font.woff2`.

Declare them once in `src/styles/main.css`:

```css
@font-face {
	font-family: "My Font";
	src: url("/fonts/my-font.woff2") format("woff2");
	font-weight: 400;
	font-display: swap;
}
```

Prefer `.woff2`. Ship one file per weight/style you actually use.
