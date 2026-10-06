import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { fileURLToPath } from 'node:url';
import { buildIndex, remarkWikilinks, scanContent } from './src/lib/wikilinks.mjs';

// Déploiement sous un sous-chemin (ex. GitHub Pages) : SITE_BASE=/MaverickCenter/ SITE_URL=https://…
const base = process.env.SITE_BASE ?? '/';
const contentDir = fileURLToPath(new URL('./src/content/wiki', import.meta.url));

// HIDE_EXAMPLES=1 : version à montrer, sans les pages de démonstration (`status: example`).
// Même filtre dans src/lib/wiki.ts, sinon les liens pointeraient vers des pages absentes.
const includeExamples = process.env.HIDE_EXAMPLES !== '1';

// L'index est lu au démarrage : relancer `npm run dev` après l'ajout d'une nouvelle page.
const index = buildIndex(scanContent(contentDir, { includeExamples }));

export default defineConfig({
  base,
  // OUT_DIR / INLINE_CSS : utilisés par tools/build-artifact.mjs (version publiable sans dépendances externes).
  outDir: process.env.OUT_DIR ?? './dist',
  build: { inlineStylesheets: process.env.INLINE_CSS === '1' ? 'always' : 'auto' },
  site: process.env.SITE_URL,
  trailingSlash: 'always',
  markdown: {
    // Sätteri est le processeur par défaut d'Astro 7 mais n'exécute pas les plugins remark :
    // on garde unified pour le plugin des [[liens]].
    processor: unified({ remarkPlugins: [[remarkWikilinks, { index, base }]] }),
  },
});
