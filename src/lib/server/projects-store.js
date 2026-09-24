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

export async function updateProject(db, id, patch) {
	const current = await getProjectById(db, id);
	if (!current) return null;
	const cleanPatch = { ...patch };
	if (patch.description) cleanPatch.description = sanitizeDescription(patch.description);
	const updated = { ...current, ...cleanPatch, id };
	await db
		.prepare("UPDATE projects SET slug = ?, data = ? WHERE id = ?")
		.bind(updated.slug, JSON.stringify(updated), id)
		.run();
	return updated;
}

export async function deleteProject(db, id) {
	const result = await db.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
	return result.meta.changes > 0;
}
