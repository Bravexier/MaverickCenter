import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { fileURLToPath } from 'node:url';
import { buildIndex, remarkWikilinks, scanContent } from './src/lib/wikilinks.mjs';
import { remarkCouleursDeCase } from './src/lib/markdown-couleurs.mjs';
import { integrationServeur } from './serveur/livraison.mjs';

// Déploiement sous un sous-chemin (ex. GitHub Pages) : SITE_BASE=/MaverickCenter/ SITE_URL=https://…
const base = process.env.SITE_BASE ?? '/';
// Service des personnages (mode client / serveur, docs/serveur.md) : en développement, `npm run serveur` écoute ici et `npm run dev` lui transmet /api/.
const service = `http://127.0.0.1:${process.env.PORT_SERVICE ?? 8787}`;
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
  // Le service est livré avec le site, dans dist/_serveur/ (serveur/livraison.mjs).
  integrations: [integrationServeur()],
  vite: {
    server: {
      proxy: { [`${base}api/`]: { target: service, rewrite: (chemin) => chemin.slice(base.length - 1) } },
    },
  },
  markdown: {
    // Sätteri est le processeur par défaut d'Astro 7 mais n'exécute pas les plugins remark :
    // on garde unified pour le plugin des [[liens]] (et celui de la couleur des cases de tableau, lib/markdown-couleurs.mjs).
    processor: unified({ remarkPlugins: [[remarkWikilinks, { index, base }], remarkCouleursDeCase] }),
  },
});
