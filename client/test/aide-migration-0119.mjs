// Ce que la migration 0119 (classes, matériaux d'armes, limite D12 : R238, R241, R252) a réécrit par fragments dans `page.corps_md`, lu dans son registre
// (`textes` de data/migrations/0119-classes-materiaux-d12.json). Elle a réécrit ces corps après le site de dev (les 27 pages de race : « Classes
// accessibles », R238 (1)) : dans baseDImport(), une cellule qu'une migration a réécrite après le site garde la valeur de la migration, qui porte encore les
// modifications du site (balises de mots-clés…), alors que les tables voisines (race_onglet, race_don…) reviennent à l'import. Un test qui compare ces
// tables à la page dans l'état d'import (races_onglet.py --verifier) remet d'abord ces corps dans leur état « import + 0119 » par cette aide, sans liste écrite
// à la main : la valeur d'import de la cellule (lib/historique-site.mjs#valeurDImport, lue sur la base courante), puis chaque fragment `avant` du registre
// remplacé par son `apres` (aide-textes-reecrits.mjs#ecrituresReecrites).
//
//   pagesReecritesParLa0119()                  les ids des pages dont la 0119 réécrit `corps_md` par fragments (registre).
//   corpsDImportApresLa0119(courante, id)      le corps de la page à l'import, réécrit par la 0119 ; une Error si un fragment manque.
//   remettreLesCorpsDeLa0119(ecriture, courante, { prefixe })
//                                              dans `ecriture` (copie de la base d'import, ouverte en écriture), le corps de chaque page de la 0119 de ce
//                                              préfixe (« races/ ») que le site a modifiée, remis à « import + 0119 » ; rend les ids remis.
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { ecrituresReecrites, textesReecrits } from './aide-textes-reecrits.mjs';

const MIGRATION = '0119-classes-materiaux-d12';

/** Les ids des pages dont la 0119 réécrit `corps_md` par fragments (registre `textes`). */
export const pagesReecritesParLa0119 = () => new Set(textesReecrits(MIGRATION)
  .filter((t) => t.table === 'page' && t.col === 'corps_md').map((t) => t.cle.id));

/**
 * Le corps de la page `id` dans l'état « import + 0119 » : sa valeur d'import (avant la première modification du site, lue sur `courante`, la base
 * courante qui porte l'historique), où chaque fragment `avant` de la 0119 est remplacé par son `apres`. Une Error si un fragment n'y est ni avant ni après :
 * la valeur d'import n'est pas celle que la migration a lue.
 * @param {import('node:sqlite').DatabaseSync} courante
 * @param {string} id
 */
export function corpsDImportApresLa0119(courante, id) {
  const cle = { id };
  const dImport = historiqueSite(courante).valeurDImport('page', cle, 'corps_md');
  if (typeof dImport !== 'string') throw new Error(`${id} : pas de corps d'import`);
  const [, reecrit] = ecrituresReecrites(MIGRATION)('page', cle, 'corps_md', dImport);
  for (const t of textesReecrits(MIGRATION).filter((x) => x.table === 'page' && x.col === 'corps_md' && x.cle.id === id)) {
    if (!reecrit.includes(t.apres)) throw new Error(`${id} : le fragment de la 0119 (« ${t.avant.slice(0, 40)}… ») manque à la valeur d'import`);
  }
  return reecrit;
}

/**
 * Remet dans `ecriture` le corps de chaque page de la 0119 dont l'id commence par `prefixe` et que le site a modifiée (les autres sont déjà dans leur état
 * « import + 0119 » dans la base d'import) ; rend les ids remis. Le préfixe est obligatoire : les pages que le site a écrites (guide/l-univers…) n'ont pas
 * de texte d'import qui porte le fragment, la valeur de la migration y est la bonne.
 * @param {import('node:sqlite').DatabaseSync} ecriture copie de la base d'import, ouverte en écriture
 * @param {import('node:sqlite').DatabaseSync} courante base courante (historique du site)
 * @param {{ prefixe: string }} options ex. « races/ »
 */
export function remettreLesCorpsDeLa0119(ecriture, courante, { prefixe }) {
  if (!prefixe) throw new Error('remettreLesCorpsDeLa0119 : préfixe des pages manquant');
  const h = historiqueSite(courante);
  const remis = [];
  const maj = ecriture.prepare('UPDATE page SET corps_md = ? WHERE id = ?');
  for (const id of pagesReecritesParLa0119()) {
    if (!id.startsWith(prefixe) || !h.modifiee('page', { id }, 'corps_md')) continue;
    if (maj.run(corpsDImportApresLa0119(courante, id), id).changes === 1) remis.push(id);
  }
  return remis;
}
