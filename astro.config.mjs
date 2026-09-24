// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: {
    build: {
      // Never inline scripts into the HTML: every script is served as a
      // file from this origin, which is what lets the Content-Security-Policy
      // (src/lib/server/security-headers.ts) forbid inline scripts outright —
      // the main defence against injected-script (XSS) attacks.
      assetsInlineLimit: () => false,
    },
  },
  // The admin's former Portuguese URLs, so old bookmarks keep working.
  redirects: {
    '/admin/configuracoes': '/admin/settings',
    '/admin/projetos': '/admin/projects',
    '/admin/projetos/novo': '/admin/projects/new',
    '/admin/projetos/[id]': '/admin/projects/[id]',
    '/admin/sobre': '/admin/about',
    '/admin/midia': '/admin/media',
  },
  // Prefetches every linked page's HTML as soon as the current page has
  // finished loading (not waiting for hover/viewport) — by the time the
  // visitor actually clicks a nav link, its page is already fetched, so the
  // navigation feels instant.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'load',
  },
});
