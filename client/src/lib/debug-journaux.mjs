// Journaux du serveur sur la page Debug (demande du propriétaire : « les logs du serveur (avec une possibilité de filtrer) » ; pages/debug.astro,
// src/scripts/debug.mjs) : fonctions pures sur les réponses de GET <base>api/debug/journal/ (serveur/journal-du-service.mjs) :
//   { processus, entrees: [{ n, instant, niveau, categorie, message, duree_ms?, methode?, route?, statut?, octets_sortie? }], dernier, capacite, perdues }
// Une entrée `http` porte ses champs isolés en plus du message (demande du propriétaire du 2026-10-15 : « isoler les informations de temps de
// réponse ») : la colonne Durée les montre, se trie, et le filtre « plus lent que … ms » les lit (?min_ms=, et dans la page).
// La page relève toutes les 2 s les entrées qui suivent la dernière vue (?depuis=<dernier>), les garde (GARDEES_MAX au plus) et en affiche au plus
// AFFICHEES_MAX, filtrées par niveau, catégorie, texte et durée, la plus récente en haut (ou triées par durée). Niveaux, catégorie, texte et tri
// s'appliquent dans la page : les changer ne redemande rien au service ; le seuil de durée, lui, part au service (?min_ms=) et fait tout relire.
// Sans dépendance hors de l'autre module de la même page (lib/debug-metriques.mjs) ; importé par le seul script de la page Debug.
import { echapper, formaterDuree, lenteur } from './debug-metriques.mjs';

/** Écriture de recherche : minuscules, sans accents. */
const cle = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

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

/** Les tris du tableau des journaux : par heure (la plus récente en haut, par défaut) ou par durée (la plus lente en haut). */
export const TRIS_DU_JOURNAL = ['instant', 'duree'];
export const TRI_DU_JOURNAL_PAR_DEFAUT = { cle: 'instant', sens: 'desc' };

/**
 * L'adresse de la relève : `api` = « <base>api/ » ; après la première, les entrées qui suivent `depuis` ; `minMs` > 0 : seulement les requêtes
 * plus lentes que ce seuil (?min_ms=, en millisecondes).
 */
export function adresseDuJournal(api, depuis = 0, { minMs = 0 } = {}) {
  const parametres = [];
  if (depuis > 0) parametres.push(`depuis=${depuis}`);
  if (Number(minMs) > 0) parametres.push(`min_ms=${encodeURIComponent(String(Number(minMs)))}`);
  return `${api}debug/journal/${parametres.length ? `?${parametres.join('&')}` : ''}`;
}

/** La durée isolée d'une entrée (ms), ou null (une entrée qui n'est pas une requête). */
export const dureeDe = (e) => (typeof e?.duree_ms === 'number' && Number.isFinite(e.duree_ms) ? e.duree_ms : null);

/** L'état vide de la page : aucune entrée, rien vu, aucun processus connu. */
export const etatVide = () => ({ entrees: [], dernier: 0, perdues: 0, capacite: null, processus: null });

const valide = (e) => e && Number.isInteger(e.n) && typeof e.message === 'string';

/**
 * L'état de la page après une réponse du journal : les nouvelles entrées (n plus grand que le dernier vu) à la suite, GARDEES_MAX au plus.
 * Le service a redémarré — sa numérotation repart de 1 — quand la réponse vient d'un autre processus que celui que la page lisait (`processus`,
 * tiré à chaque démarrage : seul signe sûr quand le nouveau service a déjà écrit autant de lignes que la page en avait vu, ou plus, onglet caché ou
 * relève en pause), ou quand son `dernier` est plus petit que celui de la page : `redemarre: true` et l'état est vidé, la page redemande tout
 * depuis le début (rien du nouveau processus n'est sauté). Rend { etat, ajoutees, redemarre }.
 */
export function fusionner(etat, reponse) {
  const dernier = Number(reponse?.dernier);
  if (!Number.isInteger(dernier) || dernier < 0) return { etat, ajoutees: 0, redemarre: false };
  const processus = typeof reponse.processus === 'string' && reponse.processus ? reponse.processus : null;
  const autreProcessus = Boolean(processus && etat.processus && processus !== etat.processus);
  if (autreProcessus || dernier < etat.dernier) return { etat: etatVide(), ajoutees: 0, redemarre: true };
  const recues = (Array.isArray(reponse.entrees) ? reponse.entrees : []).filter((e) => valide(e) && e.n > etat.dernier).sort((a, b) => a.n - b.n);
  const entrees = [...etat.entrees, ...recues].slice(-GARDEES_MAX);
  return {
    etat: {
      entrees,
      dernier: Math.max(dernier, recues.at(-1)?.n ?? 0),
      perdues: Number.isInteger(reponse.perdues) ? reponse.perdues : etat.perdues,
      capacite: Number.isInteger(reponse.capacite) ? reponse.capacite : etat.capacite,
      processus: processus ?? etat.processus ?? null,
    },
    ajoutees: recues.length,
    redemarre: false,
  };
}

/**
 * Les entrées qui passent les filtres, AFFICHEES_MAX au plus : niveaux (les cases cochées : un ensemble ou un tableau ; aucune : rien), categorie
 * ('' : toutes), texte (chaque mot, sans accents ni majuscules, dans le message ou la catégorie), minMs (> 0 : seulement les entrées dont la durée
 * isolée atteint ce seuil — une entrée sans durée n'en est pas). Tri : par défaut la plus récente d'abord (les AFFICHEES_MAX plus récentes) ;
 * { cle: 'instant', sens: 'asc' } les mêmes, la plus ancienne d'abord ; { cle: 'duree' } la plus lente d'abord (ou la plus rapide, 'asc'), les
 * entrées sans durée à la fin, à durée égale la plus récente d'abord.
 * Rend { lignes, total } (total : celles qui passent, avant la coupe).
 */
export function filtrerEntrees(entrees, { niveaux = NIVEAUX.map((n) => n.cle), categorie = '', texte = '', minMs = 0, tri = TRI_DU_JOURNAL_PAR_DEFAUT } = {}) {
  const permis = new Set(niveaux);
  const mots = cle(texte).split(/\s+/).filter(Boolean);
  const seuil = Number(minMs) > 0 ? Number(minMs) : 0;
  const passent = entrees.filter((e) => permis.has(e.niveau)
    && (!categorie || e.categorie === categorie)
    && (!seuil || (dureeDe(e) ?? -1) >= seuil)
    && (!mots.length || ((t) => mots.every((m) => t.includes(m)))(cle(`${e.message} ${e.categorie}`))));
  if (tri?.cle === 'duree') {
    const signe = tri.sens === 'asc' ? 1 : -1;
    const triees = [...passent].sort((a, b) => {
      const da = dureeDe(a);
      const db = dureeDe(b);
      if (da === null || db === null) return da === db ? b.n - a.n : da === null ? 1 : -1;
      return signe * (da - db) || b.n - a.n;
    });
    return { lignes: triees.slice(0, AFFICHEES_MAX), total: passent.length };
  }
  const recentes = passent.slice(-AFFICHEES_MAX);
  return { lignes: tri?.sens === 'asc' ? recentes : recentes.reverse(), total: passent.length };
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

/**
 * Comment passer des lignes affichées (`avant` : leurs n, la plus récente en haut) à celles qui doivent l'être (`apres`) sans refaire le tableau :
 * { ajout, retrait } — `ajout` lignes nouvelles à insérer en haut, `retrait` lignes à ôter en bas (le plafond AFFICHEES_MAX) — quand `apres` n'est
 * que `avant` précédé des nouvelles entrées ; null sinon (filtre changé, effacement, redémarrage : tout se refait). Les lignes gardées restent les
 * mêmes nœuds : la ligne lue ne bouge pas et une sélection en cours survit à la relève.
 */
export function planDAffichage(avant, apres) {
  if (!avant.length) return null;
  const ajout = apres.indexOf(avant[0]);
  if (ajout < 0) return null;
  const gardees = apres.length - ajout;
  if (gardees > avant.length) return null;
  for (let i = 0; i < gardees; i++) if (apres[ajout + i] !== avant[i]) return null;
  return { ajout, retrait: avant.length - gardees };
}

const NIVEAU_CONNU = new Set(NIVEAUX.map((n) => n.cle));

/** Les lignes du tableau des journaux (heure, niveau, catégorie, durée isolée, message), dans l'ordre donné ; une durée lente est marquée. */
export function htmlDesLignes(lignes, maintenant = new Date()) {
  return lignes.map((e) => {
    const niveau = NIVEAU_CONNU.has(e.niveau) ? e.niveau : 'info';
    const duree = dureeDe(e);
    const lente = duree === null ? '' : lenteur(duree);
    return `<tr class="debug-ligne debug-ligne--${niveau}" data-n="${e.n}">`
      + `<td class="debug-ligne__heure"><time datetime="${echapper(e.instant)}">${echapper(heureDe(e.instant, maintenant))}</time></td>`
      + `<td class="debug-ligne__niveau"><span class="debug-niveau debug-niveau--${niveau}">${echapper(e.niveau)}</span></td>`
      + `<td class="debug-ligne__categorie">${echapper(e.categorie)}</td>`
      + `<td class="debug-ligne__duree"${lente ? ` data-lenteur="${lente}"` : ''}>${duree === null ? '' : formaterDuree(duree)}</td>`
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
