import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { fileURLToPath } from 'node:url';
import { buildIndex, remarkWikilinks, scanContent } from './src/lib/wikilinks.mjs';

// Déploiement sous un sous-chemin (ex. GitHub Pages) : SITE_BASE=/MaverickCenter/ SITE_URL=https://…
const base = process.env.SITE_BASE ?? '/';
const contentDir = fileURLToPath(new URL('./src/content/wiki', import.meta.url));

// L'index est lu au démarrage : relancer `npm run dev` après l'ajout d'une nouvelle page.
const index = buildIndex(scanContent(contentDir));

export default defineConfig({
  base,
  site: process.env.SITE_URL,
  trailingSlash: 'always',
  markdown: {
    // Sätteri est le processeur par défaut d'Astro 7 mais n'exécute pas les plugins remark :
    // on garde unified pour le plugin des [[liens]].
    processor: unified({ remarkPlugins: [[remarkWikilinks, { index, base }]] }),
  },
});
