// Filtre des armes par compétence sur /ressources/armes/ (demande du propriétaire, 2026-10-13 : « j'aimerais pouvoir filtrer les armes par compétence arc /
// arbalète / légère et lourde ») : des boutons à bascule, un par compétence d'arme (lib/arme-champs.mjs#COMPETENCES_D_ARME) ; comme les filtres du
// bestiaire, une arme reste affichée si l'UNE de ses compétences est choisie (« Arc / Arme Légère » sous Arc comme sous Légère), toutes sans choix.
// L'état est dans l'adresse : ?competence=arc,arbalete (ids de la table competence, dans l'ordre des boutons).
// Sans dépendance ni import : importé par le seul script de la page (src/scripts/armes.mjs), qui lit les compétences d'une ligne dans son attribut
// data-competences (lib/armes-rendu.mjs#htmlDeCompetence) et la liste des compétences connues dans les boutons.

/** Nom du paramètre de l'adresse. */
export const PARAMETRE_DES_COMPETENCES = 'competence';

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

/** Une arme est affichée sans choix, ou si l'une de ses compétences est choisie (une arme sans compétence reconnue ne l'est qu'alors). */
export const armeVisible = (competences, choisies) => !choisies.length || competences.some((c) => choisies.includes(c));
