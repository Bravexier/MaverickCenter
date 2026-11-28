// Le lot de changements qui pose le repère de chaque mot-clé sans élément (chantier 4 des mots-clés, « le retrait des colonnes » :
// docs/chantier-retrait-des-colonnes.md, §2 et §7, étape « Lot « repères » »). Un repère (table `repere`, migration 0135) est l'élément d'un mot-clé que ne
// désigne ni une page (`page.mot_cle_id`) ni un sort (`sort.mot_cle_id`) : il garde son nom, son adresse, sa définition, sa couleur et son icône, recopiés
// tels quels des colonnes du mot-clé (NULL reste NULL), qui font encore foi. Un mot-clé qui a déjà son repère n'en reçoit pas un second. Sur une base passée
// par la migration 0136, qui pose elle-même ces repères et retire les colonnes, le lot n'a plus rien à poser (null) : il ne sert plus que de contrôle.
// Pur : aucune dépendance au navigateur, à Astro ni à node:… (skill site-version-portable) ; `db` est une base ouverte par l'appelant
// (scripts/lot-des-reperes.mjs, les tests), qui n'y écrit rien.
import { FORMAT_DU_LOT } from './lot-de-changements.mjs';
import { DECISION_DE_L_ANCRAGE } from './lots-d-ancrage.mjs';

/** L'auteur écrit dans le lot : celui d'un lot de l'équipe, jamais celui de l'action « Préparer l'ancrage » (lib/lots-d-ancrage.mjs#estUnLotDAncrage). */
export const AUTEUR_DU_LOT_DES_REPERES = 'lot des repères';

/** Les colonnes d'un repère, dans l'ordre de la table, et la colonne du mot-clé que chacune recopie. */
export const COLONNES_DU_REPERE = Object.freeze({ mot_cle_id: 'id', nom: 'libelle', adresse: 'url', definition: 'description', couleur: 'couleur', icone: 'icone' });

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));

const SANS_ELEMENT = `
    WHERE NOT EXISTS (SELECT 1 FROM page p WHERE p.mot_cle_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM sort s WHERE s.mot_cle_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM repere r WHERE r.mot_cle_id = m.id)
    ORDER BY m.id`;

/**
 * Les mots-clés sans page, sans sort et sans repère, par id croissant : chacun dans la forme de son repère ({ mot_cle_id, nom, adresse, definition, couleur,
 * icone }). Lève une `Error` sur une base d'avant la migration 0135. Depuis la migration 0136, le mot-clé n'a plus ces colonnes : la migration a posé le
 * repère de chaque mot-clé sans page ni sort, il n'y a plus rien à recopier ; la liste est vide, et un mot-clé resté sans élément (base incohérente, que
 * db:check refuse) lève une `Error` qui le nomme, puisque rien ne dit plus son nom.
 */
export function reperesAPoser(db) {
  if (!tableExiste(db, 'repere')) throw new Error('cette base n’a pas la table des repères (migration 0135)');
  const colonnesDuMotCle = new Set(db.prepare("SELECT name FROM pragma_table_info('mot_cle')").all().map((c) => c.name));
  if (!colonnesDuMotCle.has('libelle')) {
    const seuls = db.prepare(`SELECT m.id FROM mot_cle m ${SANS_ELEMENT}`).all().map((l) => l.id);
    if (seuls.length) throw new Error(`mot-clé sans page, sans sort ni repère, et dont plus rien ne dit le nom (migration 0136) : ${seuls.join(', ')}`);
    return [];
  }
  const colonnes = Object.entries(COLONNES_DU_REPERE).map(([repere, motCle]) => `m."${motCle}" AS "${repere}"`).join(', ');
  return db.prepare(`SELECT ${colonnes} FROM mot_cle m ${SANS_ELEMENT}`).all().map((l) => ({ ...l }));
}

/** Les opérations du lot : une insertion dans `repere` par mot-clé sans élément. */
export const operationsDesReperes = (db) => reperesAPoser(db).map((r) => ({ table: 'repere', cle: { mot_cle_id: r.mot_cle_id }, operation: 'inserer', apres: r }));

/**
 * Le lot « maverick-lot/1 » des repères de `db`, ou null s'il n'y a rien à poser (un lot sans opération n'existe pas). Nature « decision », rattaché à la
 * décision de l'ancrage (R309, « les mots-clés au centre »), comme les lots de l'équipe qui corrigent un mot-clé ancré.
 * @param {{ prepare: Function }} db
 * @param {{ titre?: string }} [options] le titre du lot (défaut : il dit le nombre de repères)
 */
export function lotDesReperes(db, { titre = null } = {}) {
  const operations = operationsDesReperes(db);
  if (!operations.length) return null;
  const n = operations.length;
  return {
    format: FORMAT_DU_LOT,
    titre: titre ?? `Mots-clés : ${n > 1 ? `les repères des ${n} mots-clés` : 'le repère du mot-clé'} sans page ni sort`,
    nature: 'decision',
    decision: DECISION_DE_L_ANCRAGE,
    auteur: AUTEUR_DU_LOT_DES_REPERES,
    operations,
  };
}
