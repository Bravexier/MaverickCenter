// Altérations d'état repérées dans le texte d'un sort (table sort_etat, data/schema.sql section 3) : la règle documentée de l'importeur des magies,
// réécrite pour l'édition depuis le site de dev (client/serveur/edition.mjs : une case modifiée refait les lignes de son sort). test/sort-etats.test.mjs
// la rejoue sur les 322 sorts de la base : elle redonne les lignes de sort_etat.
//
// Seules les tournures explicites sont retenues (« Non exhaustif » : une mention libre comme « Coma. », « lien de gel » ou « Peur 3 pour la cible »
// n'en est pas une) ; `relation` redit la tournure, pas une règle :
//   'inflige' : « Inflige / infliger / Rend la cible / État « … » <état> [n] » (« Inflige un saignement particulier » : l'article est sauté) ;
//   'prend'   : « pour ne pas prendre / ne pas être <état> [n] » ;
//   'soigne'  : « soigner [un état de] <état>, <état> et <état> ».
// `extrait` est la phrase qui contient la tournure (la case découpée aux retours à la ligne et après chaque point suivi d'une espace), `forme_trouvee`
// le mot rapproché de l'état tel qu'il est écrit : le nom de l'état (sans tenir compte des accents ni des majuscules) ou l'une des écritures que les
// lignes de l'import rapprochent d'un état (FORMES_D_ETAT). `stade` : le nombre de 1 à 3 qui suit (« gel 2 », « stade 1 », « au stade 1 », « niveau 3 »),
// sinon NULL. `rang` : l'occurrence de la même altération (même état, même relation) dans le sort, les cases dans l'ordre CHAMPS_DES_ETATS.
// Une case se lit sans les balises du glossaire des mots-clés (lib/mots-cles-balises.mjs : le texte d'une case porte celui de chaque balise).
// Fonctions pures, sans dépendance navigateur ni Astro (dépendances : lib/text.mjs, lib/mots-cles-balises.mjs).
import { texteSansBalises } from './mots-cles-balises.mjs';
import { normalize } from './text.mjs';

/** Cases d'un sort lues pour les altérations d'état (CHECK de sort_etat.champ, dans l'ordre des rangs) et leur colonne dans la table sort. */
export const CHAMPS_DES_ETATS = { type: 'type_brut', cout: 'cout_brut', zone: 'zone_brut', dsb: 'dsb_brut', effets: 'effets' };

/**
 * Écritures d'un état autres que son nom, relevées dans les lignes de l'import (forme normalisée → nom normalisé de l'état) : « aveuglé » (Grenade
 * flash), « Empoisonné » (Câlin putréfié…), « confus » (Souffle hydraulique…). Aucune autre n'est supposée.
 */
const FORMES_D_ETAT = { aveugle: 'aveuglement', empoisonne: 'poison', confus: 'confusion' };

const L = '\\p{L}';
const BLANC = '[\\s\\u00a0\\u202f]';
const TOURNURE = new RegExp(
  `(?<![${L}])(?:(?<inflige>infliger?|rend${BLANC}+la${BLANC}+cible)|(?<etat>[ée]tat)(?=${BLANC}*[«"“])|(?<prend>pour${BLANC}+ne${BLANC}+pas${BLANC}+prendre|ne${BLANC}+pas${BLANC}+[êe]tre)|(?<soigne>soigner))(?![${L}])`,
  'giu',
);
const MOTS = new RegExp(`^[${L}]+(?:${BLANC}+[${L}]+){0,2}`, 'u');
const STADE = new RegExp(`^${BLANC}*(?:(?:au${BLANC}+)?(?:stade|niveau)${BLANC}+)?([1-3])(?![0-9])`, 'iu');
const OUVRANT = new RegExp(`^${BLANC}*[«"“]${BLANC}*`, 'u');
const FERMANT = new RegExp(`^${BLANC}*[»"”]`, 'u');
const ARTICLE = new RegExp(`^${BLANC}*un${BLANC}+`, 'iu');
const ETAT_DE = new RegExp(`^${BLANC}*un${BLANC}+[ée]tat${BLANC}+de${BLANC}+`, 'iu');
const SEPARATEUR = new RegExp(`^${BLANC}*(?:,${BLANC}*(?:et${BLANC}+)?|${BLANC}et${BLANC}+)`, 'iu');
const ESPACES = new RegExp(`^${BLANC}*`, 'u');

/** Les phrases d'une case : coupée aux retours à la ligne et après un point suivi d'une espace ; chacune sans ses espaces de bord. */
export function phrasesDe(texte) {
  return String(texte ?? '')
    .split(/\n|(?<=\.)[ \t  ]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Table des écritures reconnues (forme normalisée → id de l'état) pour une liste d'états { id, nom } (table etat). */
export function formesDesEtats(etats) {
  const parNom = new Map(etats.map((e) => [normalize(e.nom), e.id]));
  const formes = new Map(parNom);
  for (const [forme, nom] of Object.entries(FORMES_D_ETAT)) if (parNom.has(nom)) formes.set(forme, parNom.get(nom));
  return formes;
}

/** L'état écrit au début de `reste` (le plus long groupe de un à trois mots reconnu), avec le stade qui le suit : { etatId, forme, stade, fin } ou null. */
function etatEnTete(reste, formes) {
  let i = 0;
  const ouvrant = OUVRANT.exec(reste);
  if (ouvrant) i += ouvrant[0].length;
  const mots = MOTS.exec(reste.slice(i));
  if (!mots) return null;
  const decoupe = [...mots[0].matchAll(new RegExp(`[${L}]+`, 'gu'))];
  for (let n = decoupe.length; n >= 1; n -= 1) {
    const dernier = decoupe[n - 1];
    const forme = mots[0].slice(0, dernier.index + dernier[0].length);
    const etatId = formes.get(normalize(forme));
    if (!etatId) continue;
    let fin = i + forme.length;
    const stade = STADE.exec(reste.slice(fin));
    if (stade) fin += stade[0].length;
    const fermant = FERMANT.exec(reste.slice(fin));
    if (fermant && ouvrant) fin += fermant[0].length;
    return { etatId, forme, stade: stade ? Number(stade[1]) : null, fin };
  }
  return null;
}

/**
 * Altérations d'état d'une case, dans l'ordre du texte : [{ etat_id, relation, stade, forme_trouvee, extrait }].
 * @param {string | null} texte
 * @param {Map<string, string>} formes formesDesEtats(table etat)
 */
export function etatsDuTexte(texte, formes) {
  const sortie = [];
  // lu sans les balises du glossaire des mots-clés (lib/mots-cles-balises.mjs : « {{id|texte}} » se lit « texte »)
  for (const extrait of phrasesDe(texteSansBalises(texte))) {
    for (const m of extrait.matchAll(TOURNURE)) {
      const relation = m.groups.soigne ? 'soigne' : m.groups.prend ? 'prend' : 'inflige';
      let reste = extrait.slice(m.index + m[0].length);
      if (relation === 'soigne') {
        const etatDe = ETAT_DE.exec(reste);
        if (etatDe) reste = reste.slice(etatDe[0].length);
        // une liste : « "Poison 1", "Brûlure 1", "Paralysie 1" », « gel, confusion et saignement »
        for (;;) {
          const e = etatEnTete(reste.slice(ESPACES.exec(reste)[0].length), formes);
          if (!e) break;
          sortie.push({ etat_id: e.etatId, relation, stade: e.stade, forme_trouvee: e.forme, extrait });
          reste = reste.slice(ESPACES.exec(reste)[0].length + e.fin);
          const sep = SEPARATEUR.exec(reste);
          if (!sep) break;
          reste = reste.slice(sep[0].length);
        }
        continue;
      }
      if (m.groups.inflige) {
        const article = ARTICLE.exec(reste);
        if (article) reste = reste.slice(article[0].length);
      }
      const e = etatEnTete(reste.slice(ESPACES.exec(reste)[0].length), formes);
      if (e) sortie.push({ etat_id: e.etatId, relation, stade: e.stade, forme_trouvee: e.forme, extrait });
    }
  }
  return sortie;
}

/**
 * Les lignes de sort_etat d'un sort (sans origine ni source_ref) : chaque case de CHAMPS_DES_ETATS, `rang` = occurrence de la même altération
 * (état, relation) dans le sort.
 * @param {Record<string, string | null>} sort une ligne de la table sort
 * @param {Map<string, string>} formes formesDesEtats(table etat)
 * @returns {{ etat_id: string, relation: string, rang: number, stade: number | null, champ: string, forme_trouvee: string, extrait: string }[]}
 */
export function etatsDuSort(sort, formes) {
  const vus = new Map();
  const sortie = [];
  for (const [champ, colonne] of Object.entries(CHAMPS_DES_ETATS)) {
    for (const e of etatsDuTexte(sort[colonne], formes)) {
      const cle = `${e.etat_id}\u0000${e.relation}`;
      const rang = (vus.get(cle) ?? 0) + 1;
      vus.set(cle, rang);
      sortie.push({ etat_id: e.etat_id, relation: e.relation, rang, stade: e.stade, champ, forme_trouvee: e.forme_trouvee, extrait: e.extrait });
    }
  }
  return sortie;
}
