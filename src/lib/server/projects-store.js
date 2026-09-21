import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sanitizeRichText } from "./sanitize-rich-text.js";

const PROJECTS_JSON_URL = new URL("../../data/projects.json", import.meta.url);
const PROJECTS_JSON_PATH = fileURLToPath(PROJECTS_JSON_URL);

async function readAll() {
	const raw = await readFile(PROJECTS_JSON_PATH, "utf-8");
	return JSON.parse(raw);
}

async function writeAll(data) {
	await writeFile(PROJECTS_JSON_PATH, JSON.stringify(data, null, "\t") + "\n", "utf-8");
}

export async function listProjects() {
	const data = await readAll();
	return data.projects;
}

export async function getProjectById(id) {
	const projects = await listProjects();
	return projects.find((p) => p.id === id) ?? null;
}

function sanitizeDescription(description) {
	if (!Array.isArray(description)) return description;
	return description.map((block) => ({ ...block, text: sanitizeRichText(block.text) }));
}

export async function createProject(project) {
	const data = await readAll();
	if (data.projects.some((p) => p.id === project.id || p.slug === project.slug)) {
		throw new Error("A project with this id or slug already exists.");
	}
	const clean = { ...project, description: sanitizeDescription(project.description) };
	data.projects.push(clean);
	await writeAll(data);
	return clean;
}

export async function updateProject(id, patch) {
	const data = await readAll();
	const index = data.projects.findIndex((p) => p.id === id);
	if (index === -1) return null;
	const cleanPatch = { ...patch };
	if (patch.description) cleanPatch.description = sanitizeDescription(patch.description);
	data.projects[index] = { ...data.projects[index], ...cleanPatch, id };
	await writeAll(data);
	return data.projects[index];
}

export async function deleteProject(id) {
	const data = await readAll();
	const index = data.projects.findIndex((p) => p.id === id);
	if (index === -1) return false;
	data.projects.splice(index, 1);
	await writeAll(data);
	return true;
}
