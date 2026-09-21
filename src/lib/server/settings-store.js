import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SETTINGS_JSON_PATH = fileURLToPath(new URL("../../data/settings.json", import.meta.url));

export async function getSettings() {
	const raw = await readFile(SETTINGS_JSON_PATH, "utf-8");
	return JSON.parse(raw);
}

function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function updateSettings(patch) {
	const current = await getSettings();
	const next = { ...current };
	// Each top-level section (home, about, ...) is edited from several
	// independent admin blocks; merge objects one level deep so saving one
	// block never wipes out a field another block owns.
	for (const [key, value] of Object.entries(patch)) {
		next[key] = isPlainObject(value) && isPlainObject(current[key])
			? { ...current[key], ...value }
			: value;
	}
	await writeFile(SETTINGS_JSON_PATH, JSON.stringify(next, null, "\t") + "\n", "utf-8");
	return next;
}
