function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function getSettings(db) {
	const row = await db.prepare("SELECT value FROM settings WHERE key = 'site'").first();
	return row ? JSON.parse(row.value) : {};
}

export async function updateSettings(db, patch) {
	const current = await getSettings(db);
	const next = { ...current };
	// Each top-level section (home, about, ...) is edited from several
	// independent admin blocks; merge objects one level deep so saving one
	// block never wipes out a field another block owns.
	for (const [key, value] of Object.entries(patch)) {
		next[key] = isPlainObject(value) && isPlainObject(current[key])
			? { ...current[key], ...value }
			: value;
	}
	await db
		.prepare(
			"INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		)
		.bind(JSON.stringify(next))
		.run();
	return next;
}
