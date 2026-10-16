// Onglets Armures et Boucliers de la page /ressources/equipement/ (avant, la page /ressources/armures/ ; demandes du propriétaire, 2026-10-15 : « Je
// souhaite faire la refonte de l'onglet armure, de la même manière que les Armes » ; « Les deux seront dans la page » ; « les autres armures étant
// composées de deux matériaux il faut donc deux tables des matériaux à sélectionner pour avoir l'armure ainsi créée. Une liste plus classique est
// disponible également. Il faut aussi le tableau d'amélioration » ; « Il faut aussi inclure ce fonctionnement pour les boucliers » ; « Pour les
// bouclier c'est forme + matière ») : chargée depuis les tables de la base, jamais depuis les Markdown des pages « Armures » et « Bouclier » (qui ne
// servent plus qu'à la recherche et aux [[liens]] : lib/corps-armures.mjs), dont seules les règles (le texte avant les tableaux) s'affichent. Les
// pages « Armures » et « Bouclier » ne sont plus construites : leurs liens mènent à leur onglet (lib/metiers.mjs#adresseDePage).
// Sans dépendance (sauf des modules purs) : `chargerArmures` reçoit la base ouverte par lib/donnees.mjs.
import { PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS } from './corps-composants.mjs';
import { cleDeMateriau } from './materiaux-couleurs.mjs';

export { PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS };

/** La pièce « Bouclier » du tableau FABRICATION (« 250 RF / Classe ») : elle n'est pas une pièce d'armure. */
export const PIECE_DU_BOUCLIER = 'bouclier';
/** L'armure complète (tableau FABRICATION) : la pièce choisie au départ, celle qui coûte le prix écrit dans la grille (décision R75). */
export const ARMURE_COMPLETE = 'armure-complete';

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

// les ancres des lignes : celles du rendu (lib/armures-rendu.mjs), qui les pose
export { ancreDArmure, ancreDeBouclier } from './armures-rendu.mjs';

/** Le texte des règles d'une page : son corps avant le premier titre « ## » (le texte du classeur, A1 de l'onglet). */
export function reglesDeLaPage(corps) {
  const l = String(corps ?? '').split('\n');
  const fin = l.findIndex((x) => /^## /.test(x));
  return l.slice(0, fin < 0 ? l.length : fin).join('\n').trim();
}

/**
 * Les écarts de la source que l'import a notés dans le corps d'une page (« Écart dans la source : la fiche en tête de ligne pour « Écailles » (cellule
 * DH92) diffère de la fiche en tête de colonne (cellule DO1). […] ») : la page les montre tels qu'écrits, sous les tableaux des matériaux ; rien n'est
 * tranché (la table garde la fiche en tête de colonne).
 */
export const ecartsDeLaSource = (corps) => String(corps ?? '').split('\n').filter((l) => l.startsWith('Écart dans la source'));

/**
 * Les listes dont les rendus des cellules ont besoin (lib/armures-rendu.mjs) : les mêmes que le service donne au mode modification
 * (serveur/edition.mjs#listes) — les matériaux d'armure et de bouclier (nom, type de la table materiau : décision R62), pour les cases « Matériaux »
 * d'une armure et « Matière » d'un bouclier.
 */
export function contexteDesArmures(db) {
  return {
    materiauxDeProtection: lignes(db, `SELECT r.id, r.nom, coalesce(m.type, 'Autres') AS type FROM ressource r LEFT JOIN materiau m ON m.ressource_id = r.id
      WHERE r.genre = 'materiau' ORDER BY r.ordre, r.nom_cle`),
  };
}

/**
 * Les données de la page :
 *   materiaux       : les matières de la grille des armures, dans l'ordre de l'onglet : [{ ligne (materiau_armure), cle, nom, type, prix (celui de la
 *                     ressource : R62), description, fabrication (texte de la recette) }] ;
 *   combinaisons    : les armures de deux matières (grille), dans l'ordre de l'onglet, chacune avec `m1`, `m2` (clés de ses matières : ligne, colonne) ;
 *   particulieres   : les armures particulières (vêtements, cottes de mailles, armure montagne, armures de familiers) ;
 *   pieces          : le tableau FABRICATION sans la ligne du bouclier (lignes armure_emplacement) ; fabricationDuBouclier : celle-ci ;
 *   ameliorations   : { armure: [...], bouclier: [...] } (amelioration_equipement, par niveau) ; totaux : { armure, bouclier } (amelioration_total) ;
 *   formes          : les classes de boucliers (Bocle … Pavois), par classe ;
 *   matieres        : les matières des boucliers (materiau_bouclier), dans l'ordre de l'onglet : [{ ligne, cle, nom, type, prix }] ;
 *   boucliers       : les boucliers préfabriqués, par forme puis dans l'ordre des matières ;
 *   poids           : les poids de boucliers ;
 *   ecarts          : les écarts de la source notés dans le corps de la page « Armures » (ecartsDeLaSource) ;
 *   pages           : { armures, boucliers } : { titre, resume, corps_md }.
 */
export function chargerArmures(db) {
  const recette = (id) =>
    db.prepare(`SELECT r.texte_brut FROM recette r JOIN recette_produit p ON p.recette_id = r.id WHERE r.genre = 'materiau' AND p.ressource_id = ?
      ORDER BY r.id LIMIT 1`).get(id)?.texte_brut ?? null;
  const materiau = ({ nom, prix_ressource, description, type_materiau, ...ligne }) => ({
    ligne, cle: cleDeMateriau(ligne.ressource_id), nom, type: type_materiau ?? ligne.type ?? 'Autres', prix: prix_ressource ?? ligne.prix_brut ?? null,
    description: description ?? null, fabrication: recette(ligne.ressource_id),
  });
  const materiaux = lignes(db, `SELECT m.*, r.nom, r.prix_brut AS prix_ressource, r.description, t.type AS type_materiau FROM materiau_armure m
    JOIN ressource r ON r.id = m.ressource_id LEFT JOIN materiau t ON t.ressource_id = m.ressource_id ORDER BY m.ordre`).map(materiau);
  const armures = lignes(db, 'SELECT * FROM armure ORDER BY ordre');
  const combinaisons = armures.filter((a) => a.sorte === 'combinaison')
    .map((a) => ({ ...a, m1: cleDeMateriau(a.materiau_ligne_id), m2: cleDeMateriau(a.materiau_colonne_id) }));
  const particulieres = armures.filter((a) => a.sorte === 'particuliere');
  const emplacements = lignes(db, 'SELECT * FROM armure_emplacement ORDER BY ordre');
  const ameliorations = (cible) => lignes(db, 'SELECT * FROM amelioration_equipement WHERE cible = ? ORDER BY niveau', cible);
  const total = (cible) => db.prepare('SELECT total_brut FROM amelioration_total WHERE cible = ?').get(cible)?.total_brut ?? null;
  const matieres = lignes(db, `SELECT m.*, r.nom, r.prix_brut AS prix_ressource, r.description, t.type AS type_materiau FROM materiau_bouclier m
    JOIN ressource r ON r.id = m.ressource_id LEFT JOIN materiau t ON t.ressource_id = m.ressource_id ORDER BY m.ordre`).map(materiau);
  const ordreDesMatieres = new Map(matieres.map((m, i) => [m.ligne.ressource_id, i]));
  const formes = lignes(db, 'SELECT * FROM bouclier_classe ORDER BY classe');
  const boucliers = lignes(db, 'SELECT * FROM bouclier')
    .map((b) => ({ ...b, matiere: cleDeMateriau(b.materiau_id) }))
    .sort((a, b) => formes.findIndex((f) => f.id === a.classe_id) - formes.findIndex((f) => f.id === b.classe_id)
      || (ordreDesMatieres.get(a.materiau_id) ?? 99) - (ordreDesMatieres.get(b.materiau_id) ?? 99));
  const page = (id) => {
    const p = db.prepare('SELECT titre, resume, corps_md FROM page WHERE id = ?').get(id);
    return p ? { ...p } : null;
  };
  return {
    materiaux,
    combinaisons,
    particulieres,
    pieces: emplacements.filter((e) => e.id !== PIECE_DU_BOUCLIER),
    fabricationDuBouclier: emplacements.find((e) => e.id === PIECE_DU_BOUCLIER) ?? null,
    ameliorations: { armure: ameliorations('armure'), bouclier: ameliorations('bouclier') },
    totaux: { armure: total('armure'), bouclier: total('bouclier') },
    formes,
    matieres,
    boucliers,
    poids: lignes(db, 'SELECT * FROM bouclier_poids ORDER BY ordre'),
    ecarts: ecartsDeLaSource(page(PAGE_DES_ARMURES)?.corps_md),
    pages: { armures: page(PAGE_DES_ARMURES), boucliers: page(PAGE_DES_BOUCLIERS) },
  };
}
