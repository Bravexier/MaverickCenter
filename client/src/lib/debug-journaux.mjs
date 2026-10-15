// Journaux du serveur sur la page Debug (demande du propriétaire : « les logs du serveur (avec une possibilité de filtrer) » ; pages/debug.astro,
// src/scripts/debug.mjs) : fonctions pures sur les réponses de GET <base>api/debug/journal/ (serveur/journal-du-service.mjs) :
//   { entrees: [{ n, instant, niveau, categorie, message }], dernier, capacite, perdues }
// La page relève toutes les 2 s les entrées qui suivent la dernière vue (?depuis=<dernier>), les garde (GARDEES_MAX au plus) et en affiche au plus
// AFFICHEES_MAX, filtrées par niveau, catégorie et texte, la plus récente en haut. Les filtres s'appliquent dans la page : changer de filtre ne
// redemande rien au service.
// Sans dépendance hors du testeur de la même page (lib/debug-api.mjs) ; importé par le seul script de la page Debug.
import { cle, echapper } from './debug-api.mjs';

/** Intervalle de la relève, en millisecondes. */
export const RELEVE_MS = 2000;
/** Entrées gardées par la page (la capacité du journal du service). */
export const GARDEES_MAX = 2000;
/** Lignes affichées au plus (les plus récentes qui passent les filtres). */
export const AFFICHEES_MAX = 1000;
/** Les niveaux, dans l'ordre des cases à cocher. */
export const NIVEAUX = [
  { cle: 'info', libelle: 'Info' },
  { cle: 'avertissement', libelle: 'Avertissement' },
  { cle: 'erreur', libelle: 'Erreur' },
];

/** L'adresse de la relève : `api` = « <base>api/ » ; après la première, les entrées qui suivent `depuis`. */
export function adresseDuJournal(api, depuis = 0) {
  return `${api}debug/journal/${depuis > 0 ? `?depuis=${depuis}` : ''}`;
}

/** L'état vide de la page : aucune entrée, rien vu. */
export const etatVide = () => ({ entrees: [], dernier: 0, perdues: 0, capacite: null });

const valide = (e) => e && Number.isInteger(e.n) && typeof e.message === 'string';

/**
 * L'état de la page après une réponse du journal : les nouvelles entrées (n plus grand que le dernier vu) à la suite, GARDEES_MAX au plus.
 * Un `dernier` plus petit que celui de la page : le service a redémarré (sa numérotation repart de 1) — `redemarre: true` et l'état est vidé, la
 * page redemande tout. Rend { etat, ajoutees, redemarre }.
 */
export function fusionner(etat, reponse) {
  const dernier = Number(reponse?.dernier);
  if (!Number.isInteger(dernier) || dernier < 0) return { etat, ajoutees: 0, redemarre: false };
  if (dernier < etat.dernier) return { etat: etatVide(), ajoutees: 0, redemarre: true };
  const recues = (Array.isArray(reponse.entrees) ? reponse.entrees : []).filter((e) => valide(e) && e.n > etat.dernier).sort((a, b) => a.n - b.n);
  const entrees = [...etat.entrees, ...recues].slice(-GARDEES_MAX);
  return {
    etat: {
      entrees,
      dernier: Math.max(dernier, recues.at(-1)?.n ?? 0),
      perdues: Number.isInteger(reponse.perdues) ? reponse.perdues : etat.perdues,
      capacite: Number.isInteger(reponse.capacite) ? reponse.capacite : etat.capacite,
    },
    ajoutees: recues.length,
    redemarre: false,
  };
}

/**
 * Les entrées qui passent les filtres, la plus récente d'abord, AFFICHEES_MAX au plus : niveaux (les cases cochées : un ensemble ou un tableau ;
 * aucune : rien), categorie ('' : toutes), texte (chaque mot, sans accents ni majuscules, dans le message ou la catégorie).
 * Rend { lignes, total } (total : celles qui passent, avant la coupe).
 */
export function filtrerEntrees(entrees, { niveaux = NIVEAUX.map((n) => n.cle), categorie = '', texte = '' } = {}) {
  const permis = new Set(niveaux);
  const mots = cle(texte).split(/\s+/).filter(Boolean);
  const passent = entrees.filter((e) => permis.has(e.niveau)
    && (!categorie || e.categorie === categorie)
    && (!mots.length || ((t) => mots.every((m) => t.includes(m)))(cle(`${e.message} ${e.categorie}`))));
  return { lignes: passent.slice(-AFFICHEES_MAX).reverse(), total: passent.length };
}

/** Les catégories des entrées (et celle qui est choisie, même sans entrée), par ordre alphabétique. */
export function categoriesDes(entrees, choisie = '') {
  const toutes = new Set(entrees.map((e) => e.categorie).filter(Boolean));
  if (choisie) toutes.add(choisie);
  return [...toutes].sort((a, b) => a.localeCompare(b, 'fr'));
}

const deux = (n) => String(n).padStart(2, '0');

/** L'heure d'une entrée, à l'heure locale : « 14:05:09 », précédée du jour (« 14/10 14:05:09 ») si ce n'est pas celui de `maintenant`. */
export function heureDe(instant, maintenant = new Date()) {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return String(instant ?? '');
  const heure = `${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`;
  const memeJour = d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth() && d.getDate() === maintenant.getDate();
  return memeJour ? heure : `${deux(d.getDate())}/${deux(d.getMonth() + 1)} ${heure}`;
}

const NIVEAU_CONNU = new Set(NIVEAUX.map((n) => n.cle));

/** Les lignes du tableau des journaux (heure, niveau, catégorie, message), dans l'ordre donné. */
export function htmlDesLignes(lignes, maintenant = new Date()) {
  return lignes.map((e) => {
    const niveau = NIVEAU_CONNU.has(e.niveau) ? e.niveau : 'info';
    return `<tr class="debug-ligne debug-ligne--${niveau}" data-n="${e.n}">`
      + `<td class="debug-ligne__heure"><time datetime="${echapper(e.instant)}">${echapper(heureDe(e.instant, maintenant))}</time></td>`
      + `<td class="debug-ligne__niveau"><span class="debug-niveau debug-niveau--${niveau}">${echapper(e.niveau)}</span></td>`
      + `<td class="debug-ligne__categorie">${echapper(e.categorie)}</td>`
      + `<td class="debug-ligne__message">${echapper(e.message)}</td></tr>`;
  }).join('');
}

const pluriel = (n, un, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;

/** La phrase sous les filtres : lignes affichées, entrées gardées par la page, entrées sorties de la mémoire du service. */
export function resumeDuJournal({ affichees, total, gardees, perdues = 0, enPause = false }) {
  const morceaux = [`${pluriel(affichees, 'ligne affichée', 'lignes affichées')}${total > affichees ? ` (les ${affichees} plus récentes sur ${total})` : ''}`,
    `${pluriel(gardees, 'entrée reçue', 'entrées reçues')} depuis l’ouverture ou le dernier effacement`];
  if (perdues > 0) morceaux.push(`${pluriel(perdues, 'entrée plus ancienne n’est', 'entrées plus anciennes ne sont')} plus dans la mémoire du service`);
  return `${morceaux.join(' ; ')}.${enPause ? ' Relève en pause.' : ''}`;
}
