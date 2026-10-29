// Pages Armures et Boucliers, /ressources/armures/ et /ressources/bouclier/ (du 2026-10-16 au 2026-10-29, les onglets de la page /ressources/equipement/ ; demandes du propriétaire, 2026-10-15 : « Je
// souhaite faire la refonte de l'onglet armure, de la même manière que les Armes » ; « Les deux seront dans la page » ; « les autres armures étant
// composées de deux matériaux il faut donc deux tables des matériaux à sélectionner pour avoir l'armure ainsi créée. Une liste plus classique est
// disponible également. Il faut aussi le tableau d'amélioration » ; « Il faut aussi inclure ce fonctionnement pour les boucliers » ; « Pour les
// bouclier c'est forme + matière ») : chargée depuis les tables de la base, jamais depuis les Markdown des pages « Armures » et « Bouclier » (qui ne
// servent plus qu'à la recherche et aux [[liens]] : lib/corps-armures.mjs) ; leurs règles (le texte avant les tableaux, copié par la migration 0056)
// sont les panneaux de règles `armures` et `boucliers` (lib/panneaux-regles-db.mjs). Les pages « Armures » et « Bouclier » ne sont plus construites :
// leurs liens mènent à leur onglet (lib/metiers.mjs#adresseDePage).
// Sans dépendance (sauf des modules purs) : `chargerArmures` reçoit la base ouverte par lib/donnees.mjs.
import { PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS } from './corps-composants.mjs';
import { cleDeMateriau } from './materiaux-couleurs.mjs';
import { prixEnRo } from './arme-champs.mjs';
import { coutDeLaPiece } from './armure-champs.mjs';
import { prixDeLArmure, UNITES_PAR_MATERIAU } from './armure-forge.mjs';
import { POIDS_DES_ARMURES, valeurDuPoids } from './fiche-format.mjs';

export { PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS };

/**
 * Les deux lignes du tableau FABRICATION que la page affiche : une armure ne se fabrique plus pièce par pièce, le tableau des pièces n'est plus
 * affiché (décision R93 ; ses lignes restent les emplacements d'armure de la fiche de personnage). « Armure Complète » (« 1 000 RF / 10 RO ») : la
 * fabrication comptée dans le prix de chaque armure de la grille (R93 : « ça ne remplace pas le prix en Ricken d'or ») ; « Bouclier »
 * (« 250 RF / Classe ») : sous les formes de l'onglet Boucliers.
 */
export const FABRICATION_DE_L_ARMURE = 'armure-complete';
export const PIECE_DU_BOUCLIER = 'bouclier';

/** Le coût en RO d'une ligne du tableau FABRICATION (« 1 000 RF / 10 RO » → 10), comme le rendu « piece-cout » (lib/armures-rendu.mjs) ; null sinon. */
export const coutDeFabrication = (ligne) => {
  const rf = coutDeLaPiece(ligne?.cout_brut);
  return rf === null ? null : rf / 100;
};

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

// les ancres des lignes : celles du rendu (lib/armures-rendu.mjs), qui les pose
export { ancreDArmure, ancreDeBouclier } from './armures-rendu.mjs';

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
    poidsDeBouclier: poidsDeBouclier(db),
  };
}

/**
 * Les poids de boucliers (bouclier_poids, dans l'ordre de la liste de l'onglet), avec `valeur` et `libelle` (le choix « Poids » d'un bouclier en mode
 * modification : lib/edition-modele.mjs) : la liste `poidsDeBouclier` du service (serveur/edition.mjs#listes) et du contexte des rendus (rendu
 * « bouclier-poids », lib/armures-rendu.mjs#htmlDuPoids).
 */
export const poidsDeBouclier = (db) => lignes(db, 'SELECT * FROM bouclier_poids ORDER BY ordre').map((p) => ({ ...p, valeur: p.id, libelle: p.nom }));

/**
 * Les données de la page :
 *   materiaux       : les matières de la grille des armures, dans l'ordre de l'onglet : [{ ligne (materiau_armure), cle, nom, type, prix (celui de la
 *                     ressource : R62), prix_armure (RO de 6 unités, pour une armure : décision R93 ; null sans prix), description }] (leur
 *                     fabrication est sur la page « Composants » : lib/composants-db.mjs) ;
 *   combinaisons    : les armures de deux matières (grille), dans l'ordre de l'onglet, chacune avec `m1`, `m2` (clés de ses matières : ligne, colonne) et
 *                     `prix_calcule` (RO, null si un prix manque) : la fabrication de l'armure complète + 6 unités de chaque matériau (décision R93 ;
 *                     le prix écrit dans la grille, `prix_brut`, n'est plus affiché) ;
 *   particulieres   : les armures particulières (vêtements, cottes de mailles, armure montagne, armures de familiers) ;
 *   fabricationDeLArmure, fabricationDuBouclier : les lignes « Armure Complète » et « Bouclier » du tableau FABRICATION (armure_emplacement) ;
 *   ameliorations   : { armure: [...], bouclier: [...], armure_elementaire: [...] } (amelioration_equipement, par niveau, toutes ses colonnes : pour une
 *                     armure élémentaire, +1 à +5, cout_brut tel qu'écrit, cout_gemmes et cout_gemmes_qualite — « commune », « raffinee », « parfaite » —
 *                     ou cout_pieces_elementaires, effet_brut, bonus_ap, bonus_am, bonus_cran ; décision R165 (2) : coût cumulé, effet de la ligne) ;
 *                     totaux : { armure, bouclier, armure_elementaire } (amelioration_total ; vide dans la source pour l'armure élémentaire) ;
 *   elementaires    : les armures élémentaires (décision R165 : une armure transformée par une pièce élémentaire devient celle de sa magie et de son poids,
 *                     sans prix) : { poids (POIDS_DES_ARMURES : « Vêtement », « Léger », « Intermédiaire », « Lourd »), magies (les 14 magies des
 *                     colonnes de l'onglet, dans leur ordre — Sang, Arcane… Ombre —, jamais le Potentiel Illimité : [{ id, nom, ordre, gemme ({ id, nom },
 *                     la gemme de la magie, table gemme : ses gemmes paient l'amélioration ; null sans gemme) }]), armures ([{ id, nom, categorie, magie_id,
 *                     ap, am, effets (les lignes de la cellule « Effet(s) », armure_elementaire_effet), effets_brut, ordre }], par magie puis par poids),
 *                     solidite_base (constante 'piece_elementaire.solidite_base' : « Chaque pièce élémentaire possède 4 crans de solidité/durabilité »,
 *                     plus les crans de l'amélioration : R165 (3)) } ;
 *   formes          : les classes de boucliers (Bocle … Pavois), par classe ;
 *   matieres        : les matières des boucliers (materiau_bouclier), dans l'ordre de l'onglet : [{ ligne, cle, nom, type, prix }] ;
 *   boucliers       : les boucliers préfabriqués, par forme puis dans l'ordre des matières, chacun avec `poids_id` (la couleur de sa case : R92) ;
 *   poids           : les poids de boucliers (poidsDeBouclier) ;
 *   ecarts          : les écarts de la source notés dans le corps de la page « Armures » (ecartsDeLaSource) ;
 *   pages           : { armures, boucliers } : { titre, resume, corps_md }.
 */
export function chargerArmures(db) {
  const materiau = ({ nom, prix_ressource, description, type_materiau, ...ligne }) => ({
    ligne, cle: cleDeMateriau(ligne.ressource_id), nom, type: type_materiau ?? ligne.type ?? 'Autres', prix: prix_ressource ?? ligne.prix_brut ?? null,
    description: description ?? null,
  });
  const materiaux = lignes(db, `SELECT m.*, r.nom, r.prix_brut AS prix_ressource, r.description, t.type AS type_materiau FROM materiau_armure m
    JOIN ressource r ON r.id = m.ressource_id LEFT JOIN materiau t ON t.ressource_id = m.ressource_id ORDER BY m.ordre`).map(materiau)
    .map((m) => {
      const ro = prixEnRo(m.prix);
      return { ...m, prix_armure: ro === null ? null : Math.round(UNITES_PAR_MATERIAU * ro * 100) / 100 };
    });
  const armures = lignes(db, 'SELECT * FROM armure ORDER BY ordre');
  const emplacement = (id) => lignes(db, 'SELECT * FROM armure_emplacement WHERE id = ?', id)[0] ?? null;
  const fabricationDeLArmure = emplacement(FABRICATION_DE_L_ARMURE);
  // le prix d'une armure de la grille (décision R93) : celui des matériaux tels que la page les affiche (prix de la ressource, R62)
  const prixDesMateriaux = new Map(materiaux.map((m) => [m.ligne.ressource_id, prixEnRo(m.prix)]));
  const combinaisons = armures.filter((a) => a.sorte === 'combinaison')
    .map((a) => ({
      ...a, m1: cleDeMateriau(a.materiau_ligne_id), m2: cleDeMateriau(a.materiau_colonne_id),
      prix_calcule: prixDeLArmure(coutDeFabrication(fabricationDeLArmure),
        [a.materiau_ligne_id, a.materiau_colonne_id].map((id) => prixDesMateriaux.get(id) ?? null)).achetes,
    }));
  const particulieres = armures.filter((a) => a.sorte === 'particuliere');
  const ameliorations = (cible) => lignes(db, 'SELECT * FROM amelioration_equipement WHERE cible = ? ORDER BY niveau', cible);
  const total = (cible) => db.prepare('SELECT total_brut FROM amelioration_total WHERE cible = ?').get(cible)?.total_brut ?? null;
  // les armures élémentaires (décision R165), par magie (armure_elementaire.ordre : l'ordre des colonnes de l'onglet) puis par poids
  const effetsElementaires = new Map();
  for (const e of lignes(db, 'SELECT armure_elementaire_id, texte FROM armure_elementaire_effet ORDER BY armure_elementaire_id, rang')) {
    if (!effetsElementaires.has(e.armure_elementaire_id)) effetsElementaires.set(e.armure_elementaire_id, []);
    effetsElementaires.get(e.armure_elementaire_id).push(e.texte);
  }
  const armuresElementaires = lignes(db, 'SELECT id, nom, categorie, magie_id, ap, am, effets_brut, ordre FROM armure_elementaire ORDER BY ordre, id')
    .sort((a, b) => a.ordre - b.ordre || valeurDuPoids(a.categorie) - valeurDuPoids(b.categorie))
    .map((a) => ({ ...a, effets: effetsElementaires.get(a.id) ?? [] }));
  const magiesElementaires = lignes(db, `SELECT m.id, m.nom, min(e.ordre) AS ordre, g.ressource_id AS gemme_id, r.nom AS gemme_nom
    FROM armure_elementaire e JOIN magie m ON m.id = e.magie_id LEFT JOIN gemme g ON g.magie_id = m.id LEFT JOIN ressource r ON r.id = g.ressource_id
    GROUP BY m.id ORDER BY min(e.ordre), m.ordre`)
    .map(({ gemme_id, gemme_nom, ...m }) => ({ ...m, gemme: gemme_id ? { id: gemme_id, nom: gemme_nom } : null }));
  const solidite = db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").get();
  if (!solidite) throw new Error('constante_equipement « piece_elementaire.solidite_base » absente de la base');
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
    fabricationDeLArmure,
    fabricationDuBouclier: emplacement(PIECE_DU_BOUCLIER),
    ameliorations: { armure: ameliorations('armure'), bouclier: ameliorations('bouclier'), armure_elementaire: ameliorations('armure_elementaire') },
    totaux: { armure: total('armure'), bouclier: total('bouclier'), armure_elementaire: total('armure_elementaire') },
    elementaires: { poids: [...POIDS_DES_ARMURES], magies: magiesElementaires, armures: armuresElementaires, solidite_base: solidite.valeur },
    formes,
    matieres,
    boucliers,
    poids: poidsDeBouclier(db),
    ecarts: ecartsDeLaSource(page(PAGE_DES_ARMURES)?.corps_md),
    pages: { armures: page(PAGE_DES_ARMURES), boucliers: page(PAGE_DES_BOUCLIERS) },
  };
}
