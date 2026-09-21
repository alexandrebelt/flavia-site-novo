/**
 * Portfolio project repository.
 *
 * The data lives in `projects.json` (see `projects.schema.json` for the shape
 * of one entry). Keeping it as plain JSON means it can be dropped straight
 * into a database, a CMS, or an API response later with no rewriting.
 *
 * Each project has: id, slug, client, country, segment, year, category,
 * tags[], images[], thumbnail.
 *
 * The individual project page (/portfolio/[slug]) is generated automatically
 * for every entry.
 */
import data from './projects.json';

/** @type {Array<import('./projects.js').Project>} */
export const projects = data.projects;

export const getProject = (slug) => projects.find((p) => p.slug === slug);
