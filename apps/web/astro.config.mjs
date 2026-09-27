import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const catalogRoot = join(dirname(fileURLToPath(import.meta.url)), '../../packages/catalog/src');
const communityCatalog = JSON.parse(
  readFileSync(join(catalogRoot, 'community.generated.json'), 'utf8'),
);
const automatedPluginPaths = new Set(
  communityCatalog.entries
    .filter((entry) => entry.provenance?.status === 'community-automated')
    .flatMap((entry) => [`/en/plugins/${entry.slug}/`, `/zh/plugins/${entry.slug}/`]),
);

export default defineConfig({
  site: 'https://dsh.pub',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => {
        const { pathname } = new URL(page);
        return pathname !== '/' && pathname !== '/404/' && !automatedPluginPaths.has(pathname);
      },
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          zh: 'zh-CN',
        },
      },
    }),
  ],
  build: {
    format: 'directory',
  },
});
