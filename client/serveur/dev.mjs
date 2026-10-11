// `npm run serveur` : le service en développement, à lancer à côté de `npm run dev` (qui lui transmet /api/ : astro.config.mjs).
// Règles : la base reconstruite depuis data/rows, comme celle du site en développement (HIDE_EXAMPLES=1 : sans les pages d'exemple) ;
// base vivante : var/serveur/ (ignoré par git). Pas de surveillance : relancer après un changement de data/rows.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { construireReference } from '../scripts/db-reference.mjs';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';
import { demarrerService } from './service.mjs';

const dossier = process.env.MAVERICK_DB || join(trouverRacine(), 'var', 'serveur');
// page « Mise à jour » : la base de production (origin/master) construite à côté de la base vivante, si master est connu localement
const reference = construireReference({ sortie: join(dossier, 'reference.db') });
if (!reference.chemin) console.log(`page Mise à jour : base de référence absente (${reference.raison})`);

const service = await demarrerService({
  regles: cheminBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }),
  dossier,
  reference: reference.chemin,
  versionParDefaut: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version,
  jetonFichier: process.env.MAVERICK_GITHUB_JETON_FICHIER || null,
  hote: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8787),
  intervalle: 0,
  // en développement, l'édition est ouverte (comme sur le site de dev) sauf MAVERICK_EDITION=0
  edition: process.env.MAVERICK_EDITION !== '0',
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => service.arreter().then(() => process.exit(0)));
}
