// Filtre des armes par compétence de la page Armes (/ressources/armes/) (demande du propriétaire, 2026-10-13 : « j'aimerais pouvoir filtrer
// les armes par compétence arc / arbalète / légère et lourde ») : des boutons à bascule, un par compétence d'arme
// (lib/arme-champs.mjs#COMPETENCES_D_ARME) ; comme les filtres du bestiaire, une arme reste affichée si l'UNE de ses compétences est choisie (« Arc /
// Arme Légère » sous Arc comme sous Légère), toutes sans choix. Plus un bouton « Arme de départ » (« la possibilité de trier par "arme de départ" »)
// : seules les armes de départ, combiné aux compétences (les deux filtres à la fois, comme ceux du bestiaire). L'état est dans l'adresse :
// ?competence=arc,arbalete (ids de la table competence, dans l'ordre des boutons) et ?depart=1. Puis les comptes « N armes sur M » (tableau, onglet,
// onglet Armes) et, dans les deux menus à onglets (mêlée, distance ; demande du propriétaire, 2026-10-23), l'onglet à ouvrir quand le filtre vide
// l'onglet ouvert, et l'ancre de l'adresse qui le suit (l'onglet choisi est écrit dans l'adresse, `#famille-<id>` : « On peut retenir l'onglet ouvert
// #epee par exemple »). Une famille sans arme (créée sur le site de dev, décision R159) garde son onglet tant qu'aucun filtre n'est actif.
// Sans dépendance ni import : importé par le seul script de la page (src/scripts/armes.mjs), qui lit les compétences d'une ligne dans son attribut
// data-competences (lib/armes-rendu.mjs#htmlDeCompetence) et la liste des compétences connues dans les boutons.

/** Noms des paramètres de l'adresse. */
export const PARAMETRE_DES_COMPETENCES = 'competence';
export const PARAMETRE_DU_DEPART = 'depart';

/**
 * L'ancre que garde l'adresse des armes (`hash`, « #famille-epees ») : elle dit quelle famille d'armes est ouverte (components/Onglets.astro l'écrit
 * au choix d'un onglet ; du 2026-10-16 au 2026-10-29, aussi l'onglet de la page « Équipement », « #boucliers ») ;
 * l'ancre est donc gardée, sauf, quand une arme est ouverte, celle de la ligne d'une arme (« #arme-… », `ancreDUneArme`), que le paramètre ?arme=
 * remplace.
 */
export const ancreDesArmes = (hash, { armeOuverte, ancreDUneArme }) => (armeOuverte && ancreDUneArme ? '' : hash);

/** « Arme de départ seulement » d'après le paramètre de l'adresse (« 1 »). */
export const lireDepart = (valeur) => valeur === '1';

/** Les compétences choisies d'après le paramètre de l'adresse (« arc,arbalete ») : seules les connues, dans leur ordre, sans doublon. */
export function lireCompetences(valeur, connues) {
  const demandees = new Set(String(valeur ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  return connues.filter((id) => demandees.has(id));
}

/** Le paramètre de l'adresse pour ces choix (« » quand rien n'est choisi). */
export const ecrireCompetences = (choisies, connues) => connues.filter((id) => choisies.includes(id)).join(',');

/** Ajoute ou retire une compétence des choix ; le résultat garde l'ordre des connues. */
export function basculerCompetence(choisies, id, connues) {
  const avec = choisies.includes(id) ? choisies.filter((c) => c !== id) : [...choisies, id];
  return connues.filter((c) => avec.includes(c));
}

/**
 * Une arme est affichée si l'une de ses compétences est choisie (toutes sans choix ; une arme sans compétence reconnue ne l'est qu'alors) ET, quand
 * seules les armes de départ sont demandées, si c'en est une.
 */
export const armeVisible = (competences, choisies, { depart = false, seulementDepart = false } = {}) =>
  (!choisies.length || competences.some((c) => choisies.includes(c))) && (!seulementDepart || depart);

/**
 * Le compte d'un tableau, de l'onglet d'une famille ou de tout l'onglet Armes : « 7 armes », ou « 3 armes sur 7 » quand le filtre (`filtreActif`) en
 * cache ; `toujoursSur` (le compte de tout l'onglet, comme avant les menus) : « N armes sur M » dès que le filtre est actif, même sans arme écartée.
 */
export function texteDuCompte(affichees, toutes, filtreActif, { toujoursSur = false } = {}) {
  const armes = (n) => `${n} arme${n > 1 ? 's' : ''}`;
  return filtreActif && (toujoursSur || affichees < toutes) ? `${armes(affichees)} sur ${toutes}` : armes(toutes);
}

/**
 * Les deux menus à onglets de l'onglet Armes (mêlée, distance ; demande du propriétaire, 2026-10-23), après le filtre : l'onglet à ouvrir dans un menu.
 * `comptes` : le nombre d'armes affichées de chaque onglet, dans l'ordre du menu ; `ouvert` : l'index de l'onglet ouvert (-1 si aucun). Rend l'index du
 * premier onglet qui a des armes quand l'ouvert n'en a plus, sinon null : rien à changer (l'ouvert en a), ou aucun n'en a (le menu se cache). Sans filtre
 * actif (`filtreActif` faux : aucun choix, ou le mode modification), null : une famille sans arme (créée sur le site de dev, décision R159) reste
 * ouverte, et son onglet affiché.
 */
export function ongletARouvrir(comptes, ouvert, { filtreActif = true } = {}) {
  if (!filtreActif) return null;
  if (ouvert >= 0 && comptes[ouvert] > 0) return null;
  const premier = comptes.findIndex((n) => n > 0);
  return premier < 0 || premier === ouvert ? null : premier;
}

/**
 * L'ancre de l'adresse quand le filtre fait passer un menu de l'onglet `fermee` à l'onglet `ouverte` (les ids de leurs panneaux, « famille-epees ») :
 * l'onglet choisi est écrit dans l'adresse (demande du propriétaire, 2026-10-23 : « On peut retenir l'onglet ouvert #epee par exemple »), qui suit donc
 * l'onglet qui s'ouvre quand elle désignait celui qui se ferme — son panneau (« #famille-epees ») ou un élément qu'il contient (`dansLaFermee`, une ligne
 * d'arme « #arme-… » : le script le sait, pas cette fonction) ; une autre ancre (« #boucliers », l'onglet de l'autre menu, aucune) reste.
 */
export function ancreApresLeFiltre(hash, { fermee, ouverte, dansLaFermee = false }) {
  const ancre = String(hash ?? '');
  if (!ouverte || !ancre.startsWith('#')) return ancre;
  let cible;
  try {
    cible = decodeURIComponent(ancre.slice(1));
  } catch {
    return ancre; // ancre mal formée : gardée telle quelle
  }
  return cible && (cible === fermee || dansLaFermee) ? `#${ouverte}` : ancre;
}
