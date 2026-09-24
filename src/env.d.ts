/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
	interface Locals {
		user?: {
			userId: string;
			email: string;
			createdAt: string;
		};
	}
}
