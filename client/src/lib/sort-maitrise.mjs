// Niveaux de maîtrise (NM) d'un sort : les bonus que les cellules du classeur écrivent (« (+1d6/NM) », « (-5/NM) », « 3NM = … », « IC pour 3 NM »)
// lus dans la table sort_bonus_maitrise (voir data/schema.sql), et la lecture « à N NM » de la vue v_sort_bonus_au_nm.
// Fonctions pures, sans dépendance navigateur ni Astro : le futur générateur de fiche les importera tel quel.
//
// Rien n'est calculé au-delà de ce que l'écriture dit : « /NM » = une fois par NM, « /3NM » = une fois par tranche de 3 NM, « 3NM = » = à partir de 3 NM.

/** Un sort cumule 3 NM au plus (niveau par niveau du personnage, lecture d'un livre de sort, cadeau du MJ). */
export const NM_MAX = 3;

/** Colonnes de la table des sorts où un bonus peut être écrit, dans l'ordre de lecture, et leur libellé. */
export const ORDRE_CHAMPS_NM = ['type', 'cout', 'portee', 'zone', 'dsb', 'effets', 'remarque'];
export const LIBELLES_CHAMP_NM = { type: 'Type', cout: 'Coût', portee: 'Portée', zone: 'Zone', dsb: 'D/S/B', effets: 'Effets', remarque: 'Remarque' };

/**
 * Combien de fois un bonus s'applique à un niveau de maîtrise donné (même lecture que la vue SQL v_sort_bonus_au_nm) :
 * par_nm → nm / pas_nm arrondi vers le bas ; palier → 1 si nm atteint le seuil, sinon 0 ; texte → null (rien de typé).
 * @param {{ nature: string, pasNm?: number | null, seuilNm?: number | null }} bonus
 * @param {number} nm entier de 0 à NM_MAX
 */
export function applications(bonus, nm) {
  if (!Number.isInteger(nm) || nm < 0 || nm > NM_MAX) throw new RangeError(`niveau de maîtrise hors de 0..${NM_MAX} : ${nm}`);
  if (bonus.nature === 'par_nm') return Math.floor(nm / bonus.pasNm);
  if (bonus.nature === 'palier') return nm >= bonus.seuilNm ? 1 : 0;
  return null;
}

/** Les bonus d'un sort qui s'appliquent à N NM (au moins une fois), chacun avec son nombre d'applications (null pour une mention sans valeur typée). */
export function bonusAuNm(bonus, nm) {
  return bonus.map((b) => ({ ...b, applications: applications(b, nm) })).filter((b) => b.applications !== 0);
}

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Valeur de base d'une cellule : la cellule SANS l'expression de NM qu'elle porte entre parenthèses (« 55 (-5/NM) » → « 55 »,
 * « 5d6 (+3/NM) dégâts sonores » → « 5d6 dégâts sonores »). Seule l'expression exacte d'un bonus reconnu, entre parenthèses, est retirée :
 * une cellule dont l'expression n'est pas isolée dans ses parenthèses reste telle qu'écrite.
 * @param {string | null} brut
 * @param {{ champ: string, texteBrut: string }[]} bonus bonus du sort
 * @param {string} champ colonne de la cellule (« cout », « portee », « zone », « dsb »)
 */
export function sansBonus(brut, bonus, champ) {
  if (brut === null || brut === undefined) return brut;
  let texte = brut;
  for (const b of bonus) {
    if (b.champ !== champ) continue;
    texte = texte.replace(new RegExp(`\\(\\s*${echapper(b.texteBrut)}\\s*\\)`), '');
  }
  return texte === brut ? brut : texte.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '').replace(/^[ \t]+/gm, '').trim();
}

/** Lignes du bonus de maîtrise d'un sort pour l'affichage : { champ, libelle, texte } dans l'ordre de lecture (le passage de la cellule qui dit ce que l'expression modifie). */
export function lignesDeBonus(bonus) {
  return bonus.map((b) => ({ champ: b.champ, libelle: LIBELLES_CHAMP_NM[b.champ], nature: b.nature, texte: b.contexte }));
}

/**
 * Texte de la colonne `sort.bonus_maitrise` : une ligne « <Colonne> : <passage> » par bonus, dans l'ordre de lecture ; null sans bonus.
 * C'est la recopie lisible de sort_bonus_maitrise : un test contrôle qu'elle suit toujours les lignes.
 */
export function texteDeBonus(bonus) {
  if (bonus.length === 0) return null;
  return lignesDeBonus(bonus).map((l) => `${l.libelle} : ${l.texte}`).join('\n');
}
