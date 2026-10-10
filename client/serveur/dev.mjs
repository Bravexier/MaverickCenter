// `npm run serveur` : le service en développement, à lancer à côté de `npm run dev` (qui lui transmet /api/ : astro.config.mjs).
// Règles : la base reconstruite depuis data/rows, comme celle du site en développement (HIDE_EXAMPLES=1 : sans les pages d'exemple) ;
// base vivante : var/serveur/ (ignoré par git). Pas de surveillance : relancer après un changement de data/rows.
import { join } from 'node:path';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';
import { demarrerService } from './service.mjs';

const service = await demarrerService({
  regles: cheminBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }),
  dossier: process.env.MAVERICK_DB || join(trouverRacine(), 'var', 'serveur'),
  hote: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8787),
  intervalle: 0,
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => service.arreter().then(() => process.exit(0)));
}
