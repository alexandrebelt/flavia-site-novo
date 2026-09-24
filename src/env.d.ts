/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
	interface Locals {
		siteSettings: () => Promise<import("./lib/server/site-data").SiteSettings>;
		/** Public order: featured first, then the admin's newest/oldest choice. */
		projects: () => Promise<import("./lib/server/site-data").Project[]>;
		user?: {
			userId: string;
			email: string;
			createdAt: string;
		};
	}
}
