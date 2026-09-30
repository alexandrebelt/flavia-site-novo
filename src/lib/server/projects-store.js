import { sanitizeRichText } from "./sanitize-rich-text.js";

function rowToProject(row) {
	return JSON.parse(row.data);
}

export async function listProjects(db) {
	const { results } = await db.prepare("SELECT data FROM projects ORDER BY rowid").all();
	return results.map(rowToProject);
}

/** How many projects other than `exceptId` are marked featured. */
export async function countFeaturedProjects(db, exceptId) {
	const row = await db
		.prepare(
			"SELECT COUNT(*) AS total FROM projects WHERE json_extract(data, '$.featured') = 1 AND id != ?",
		)
		.bind(exceptId ?? "")
		.first();
	return Number(row?.total ?? 0);
}

export async function getProjectBySlug(db, slug) {
	const row = await db.prepare("SELECT data FROM projects WHERE slug = ?").bind(slug).first();
	return row ? rowToProject(row) : null;
}

export async function getProjectById(db, id) {
	const row = await db.prepare("SELECT data FROM projects WHERE id = ?").bind(id).first();
	return row ? rowToProject(row) : null;
}

function sanitizeDescription(description) {
	if (!Array.isArray(description)) return description;
	return description.map((block) => ({ ...block, text: sanitizeRichText(block.text) }));
}

export async function createProject(db, project) {
	const existing = await db
		.prepare("SELECT id FROM projects WHERE id = ? OR slug = ?")
		.bind(project.id, project.slug)
		.first();
	if (existing) {
		throw new Error("A project with this id or slug already exists.");
	}
	const clean = { ...project, description: sanitizeDescription(project.description) };
	await db
		.prepare("INSERT INTO projects (id, slug, data) VALUES (?, ?, ?)")
		.bind(clean.id, clean.slug, JSON.stringify(clean))
		.run();
	return clean;
}

/** Whether another project (not `exceptId`) already uses this id or slug. */
export async function findConflict(db, { id, slug }, exceptId) {
	const row = await db
		.prepare("SELECT id, slug FROM projects WHERE (id = ? OR slug = ?) AND id != ?")
		.bind(id ?? "", slug ?? "", exceptId ?? "")
		.first();
	if (!row) return null;
	return row.id === id ? "id" : "slug";
}

/**
 * Applies `patch`; a `patch.id` different from `id` renames the project
 * (the caller checks the new id is free first).
 */
export async function updateProject(db, id, patch) {
	const current = await getProjectById(db, id);
	if (!current) return null;
	const cleanPatch = { ...patch };
	if (patch.description) cleanPatch.description = sanitizeDescription(patch.description);
	const newId = typeof patch.id === "string" && patch.id ? patch.id : id;
	const updated = { ...current, ...cleanPatch, id: newId };
	await db
		.prepare("UPDATE projects SET id = ?, slug = ?, data = ? WHERE id = ?")
		.bind(newId, updated.slug, JSON.stringify(updated), id)
		.run();
	return updated;
}

export async function deleteProject(db, id) {
	const result = await db.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
	return result.meta.changes > 0;
}
