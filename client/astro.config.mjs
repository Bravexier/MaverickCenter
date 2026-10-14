import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { fileURLToPath } from 'node:url';
import { buildIndex, remarkWikilinks, scanContent } from './src/lib/wikilinks.mjs';
import { remarkCouleursDeCase } from './src/lib/markdown-couleurs.mjs';
import { remarkMonnaies } from './src/lib/markdown-monnaies.mjs';
import { integrationServeur } from './serveur/livraison.mjs';
import { integrationReference } from './scripts/db-reference.mjs';

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
  // La base de production (master), référence de la page « Mise à jour » du site de dev : dist/donnees/reference.db (scripts/db-reference.mjs).
  integrations: [integrationServeur(), integrationReference()],
  vite: {
    // version portable : le chargeur du mode modification (components/edition/Edition.astro) devient un module vide (src/scripts/edition-absente.mjs)
    resolve: {
      alias: process.env.INLINE_CSS === '1'
        ? [{ find: /^\.\.\/\.\.\/scripts\/edition\.mjs$/, replacement: fileURLToPath(new URL('./src/scripts/edition-absente.mjs', import.meta.url)) }]
        : [],
    },
    server: {
      proxy: { [`${base}api/`]: { target: service, rewrite: (chemin) => chemin.slice(base.length - 1) } },
    },
  },
  markdown: {
    // Sätteri est le processeur par défaut d'Astro 7 mais n'exécute pas les plugins remark :
    // on garde unified pour le plugin des [[liens]] (et ceux de la couleur des cases de tableau, lib/markdown-couleurs.mjs, et des monnaies en icônes, lib/markdown-monnaies.mjs).
    processor: unified({ remarkPlugins: [[remarkWikilinks, { index, base }], remarkCouleursDeCase, remarkMonnaies] }),
  },
});
