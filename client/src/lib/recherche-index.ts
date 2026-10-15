// L'index de la recherche (pages/search-index.json.ts, lu par le script de /recherche/) : les pages du wiki (loadWiki : sans les pages d'exemple sous
// HIDE_EXAMPLES) puis les événements de la chronologie (tables evenement, lib/chronologie-db.mjs), dans l'ordre de la frise. Une page porte les ids de ses
// mots-clés (`motsCles` : vocabulaire mot_cle, lib/mots-cles-db.mjs) et leurs libellés (`tags`, cherchés comme le texte). Un événement (type « Événement »)
// n'a pas de mot-clé (`motsCles` vide) : il a des catégories (categorie_chronologie, filtre de la frise), dont les libellés sont ses `tags`, cherchés comme
// le texte. La page /recherche/ en tire aussi le nombre de pages de chaque mot-clé, par le même calcul que le navigateur (comptesDesMotsCles).
import { TYPES } from './types.mjs';
import { loadWiki, typeOf } from './wiki';
import { adresseDePage } from './metiers.mjs';
import { sansMarqueurs } from './guide.mjs';
import { ouvrirBase } from './donnees.mjs';
import { chargerChronologie } from './chronologie-db.mjs';
import { adresseDEvenement, libelleDeDate } from './chronologie.mjs';
import { idDuMotCle } from './mots-cles-db.mjs';

export interface ElementDeRecherche {
  title: string;
  type: string;
  /** chemin relatif à la racine du site ; la page ajoute le préfixe (data-base), le suffixe (data-suffix) puis l'ancre */
  path: string;
  ancre?: string;
  summary: string;
  aliases: string[];
  tags: string[];
  /** ids des mots-clés (mot_cle.id) ; vide pour un événement de la chronologie (il a des catégories, dans `tags`) */
  motsCles: string[];
  text: string;
}

/** Texte brut approximatif d'une page, pour la recherche plein texte côté navigateur. */
function plainText(body: string) {
  return body
    .replace(/\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g, (_, target, label) => label ?? target)
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

async function construire(): Promise<ElementDeRecherche[]> {
  const { entries } = await loadWiki();
  const db = ouvrirBase();
  const index: ElementDeRecherche[] = entries.map((entry) => {
    // un métier : sa ligne du tableau de /metiers/ (ancre)
    const { chemin, ancre } = adresseDePage(entry.id);
    return {
      title: entry.data.title,
      type: TYPES[typeOf(entry)].singular,
      path: chemin,
      ...(ancre && { ancre }),
      summary: entry.data.summary ?? '',
      aliases: entry.data.aliases,
      tags: entry.data.tags,
      motsCles: [...new Set(entry.data.tags.map((libelle: string) => idDuMotCle(db, libelle)))],
      text: plainText(sansMarqueurs(entry.body ?? '')),
    };
  });
  // Les événements de la chronologie ne sont pas des pages du wiki : ajoutés à part, avec le texte de leurs extraits et les libellés de leurs catégories
  // (une recherche sur une catégorie les trouve) ; aucun mot-clé.
  for (const e of chargerChronologie(db)) {
    index.push({
      title: e.titre,
      type: 'Événement',
      path: adresseDEvenement(e.id),
      summary: libelleDeDate(e),
      aliases: [],
      tags: e.categories.map((c: { libelle: string }) => c.libelle),
      motsCles: [],
      text: plainText(e.extraits.map((x: { texte: string }) => x.texte).join(' ')),
    });
  }
  return index;
}

let cache: Promise<ElementDeRecherche[]> | undefined;

/** L'index de la recherche (une construction par build). */
export const indexDeRecherche = () => (cache ??= construire());
