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
import { coutDeLaPiece, coutParClasseDuBouclier } from './armure-champs.mjs';
import { defenseDeLaCombinaison, defenseDuBouclier, prixDeLArmure, prixDuBouclier, typeDeLaCombinaison } from './armure-forge.mjs';
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

/**
 * Les entrées des calculs de la décision R207 (1), E6 (« D'après les matériaux (+ cout de fabrication pour le prix) »), lues dans la base :
 *   ro          : la valeur du RO en RF (monnaie 'ro', non modifiable : R61) ;
 *   unites      : constante_equipement 'armure.unites_par_materiau' (6 : R93, migration 0105) ;
 *   fabrication : le coût de « Armure Complète » (armure_emplacement 'armure-complete', cout_rf), en RO ; null s'il n'a pas de montant ;
 *   materiauxArmure : Map ressource_id → { type, ap, am, prix } (materiau_armure ; prix : celui de la ressource, page Composants, R62, en RO) ;
 *   materiauxBouclier : Map ressource_id → { ap, am, prix } (materiau_bouclier ; prix de la ressource, en RO) ;
 *   formes      : Map id → { classe, prix } (bouclier_classe ; prix : le coût de fabrication de la forme, en RO, celui que suit le prix d'un bouclier).
 */
export function entreesDesCalculs(db) {
  const ro = db.prepare("SELECT valeur_rf FROM monnaie WHERE id = 'ro'").get()?.valeur_rf;
  if (!ro) throw new Error('monnaie « ro » absente de la base');
  const unites = db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'armure.unites_par_materiau'").get();
  if (!unites) throw new Error('constante_equipement « armure.unites_par_materiau » absente de la base');
  const enRo = (rf) => (rf === null || rf === undefined ? null : rf / ro);
  const fabrication = db.prepare('SELECT cout_rf FROM armure_emplacement WHERE id = ?').get(FABRICATION_DE_L_ARMURE);
  return {
    ro,
    unites: unites.valeur,
    fabrication: enRo(fabrication?.cout_rf),
    materiauxArmure: new Map(db.prepare('SELECT m.ressource_id, m.type, m.ap, m.am, r.prix_rf FROM materiau_armure m JOIN ressource r ON r.id = m.ressource_id').all()
      .map((m) => [m.ressource_id, { type: m.type, ap: m.ap, am: m.am, prix: enRo(m.prix_rf) }])),
    materiauxBouclier: new Map(db.prepare('SELECT m.ressource_id, m.ap, m.am, r.prix_rf FROM materiau_bouclier m JOIN ressource r ON r.id = m.ressource_id').all()
      .map((m) => [m.ressource_id, { ap: m.ap, am: m.am, prix: enRo(m.prix_rf) }])),
    formes: new Map(db.prepare('SELECT id, classe, prix FROM bouclier_classe').all().map((f) => [f.id, { classe: f.classe, prix: f.prix }])),
  };
}

/**
 * Les valeurs calculées de la décision R207 (1), E6 (lib/armure-forge.mjs) : { armures: Map id → { type, ap, am, prix } (les armures de la grille,
 * sorte 'combinaison' : type = le plus lourd des deux matériaux, AP et AM = leur somme, prix = « Armure Complète » + `unites` × le prix de chaque
 * matériau ; une armure particulière garde ses valeurs écrites, R80), boucliers: Map id → { ap, am, prix } (AP et AM = classe × ceux de la matière, prix =
 * classe × prix de la matière + prix de la forme) }. Un prix inconnu (matériau sans prix) donne null ; un type que les matériaux ne donnent pas, null.
 */
export function valeursCalculees(db, entrees = entreesDesCalculs(db)) {
  const { unites, fabrication, materiauxArmure, materiauxBouclier, formes } = entrees;
  const armures = new Map();
  for (const a of db.prepare("SELECT id, materiau_ligne_id, materiau_colonne_id FROM armure WHERE sorte = 'combinaison'").all()) {
    const [m1, m2] = [materiauxArmure.get(a.materiau_ligne_id), materiauxArmure.get(a.materiau_colonne_id)];
    armures.set(a.id, {
      type: typeDeLaCombinaison(m1?.type, m2?.type),
      ...defenseDeLaCombinaison(m1, m2),
      prix: prixDeLArmure(fabrication, [m1?.prix ?? null, m2?.prix ?? null], unites).achetes,
    });
  }
  const boucliers = new Map();
  for (const b of db.prepare('SELECT id, classe_id, materiau_id FROM bouclier').all()) {
    const forme = formes.get(b.classe_id);
    const matiere = materiauxBouclier.get(b.materiau_id);
    boucliers.set(b.id, { ...defenseDuBouclier(forme?.classe ?? null, matiere), prix: prixDuBouclier(forme?.classe, matiere?.prix, forme?.prix) });
  }
  return { armures, boucliers };
}

/**
 * Les écarts entre le prix de chaque forme de bouclier (bouclier_classe.prix, en RO : le terme de fabrication que suit le prix d'un bouclier, décision
 * R207 (1), choix de game-design) et la ligne « Bouclier » du tableau FABRICATION (armure_emplacement 'bouclier', « 250 RF / Classe »), qui n'en est
 * qu'une autre écriture : classe × le montant en RF par classe ÷ la valeur du RO. Des messages (avertissements de client/scripts/db-check.mjs) : une
 * forme dont le prix diffère, ou une ligne « Bouclier » qui ne s'écrit pas « N RF / Classe » ; [] quand tout s'accorde (ou sans ligne « Bouclier »).
 */
export function ecartsDeFabricationDuBouclier(db) {
  const ligne = db.prepare('SELECT cout_brut FROM armure_emplacement WHERE id = ?').get(PIECE_DU_BOUCLIER);
  if (!ligne) return [];
  const ro = db.prepare("SELECT valeur_rf FROM monnaie WHERE id = 'ro'").get()?.valeur_rf;
  if (!ro) return [];
  const formes = db.prepare('SELECT id, classe, prix FROM bouclier_classe ORDER BY classe').all();
  const parClasse = coutParClasseDuBouclier(ligne.cout_brut);
  if (parClasse === null) {
    return [`armure_emplacement ${PIECE_DU_BOUCLIER} : « ${ligne.cout_brut} » ne s’écrit pas « N RF / Classe » ; le prix d’un bouclier suit bouclier_classe.prix (décision R207 (1))`];
  }
  const ecarts = [];
  for (const f of formes) {
    if (Math.round(f.prix * ro) === f.classe * parClasse) continue;
    ecarts.push(`bouclier_classe ${f.id} : prix ${f.prix} RO, mais « ${ligne.cout_brut} » (armure_emplacement ${PIECE_DU_BOUCLIER}) donne `
      + `${(f.classe * parClasse) / ro} RO pour la classe ${f.classe} ; le prix d’un bouclier suit bouclier_classe.prix (décision R207 (1))`);
  }
  return ecarts;
}

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
 *                     R207 (1), E6 : valeursCalculees, égal à `prix`, que le service recalcule quand un matériau ou la fabrication change) ;
 *   particulieres   : les armures particulières (vêtements, cottes de mailles, armure montagne, armures de familiers) ;
 *   fabricationDeLArmure, fabricationDuBouclier : les lignes « Armure Complète » et « Bouclier » du tableau FABRICATION (armure_emplacement) ;
 *   unitesParMateriau : constante_equipement 'armure.unites_par_materiau' (6 : R93), les unités de chaque matériau d'une armure ;
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
  // les unités de chaque matériau d'une armure (constante_equipement 'armure.unites_par_materiau' : R93, R207 (1))
  const { unites } = entreesDesCalculs(db);
  const materiaux = lignes(db, `SELECT m.*, r.nom, r.prix_brut AS prix_ressource, r.description, t.type AS type_materiau FROM materiau_armure m
    JOIN ressource r ON r.id = m.ressource_id LEFT JOIN materiau t ON t.ressource_id = m.ressource_id ORDER BY m.ordre`).map(materiau)
    .map((m) => {
      const ro = prixEnRo(m.prix);
      return { ...m, prix_armure: ro === null ? null : Math.round(unites * ro * 100) / 100 };
    });
  const armures = lignes(db, 'SELECT * FROM armure ORDER BY ordre');
  const emplacement = (id) => lignes(db, 'SELECT * FROM armure_emplacement WHERE id = ?', id)[0] ?? null;
  const fabricationDeLArmure = emplacement(FABRICATION_DE_L_ARMURE);
  // le prix d'une armure de la grille (décisions R93, R207 (1) E6) : la formule commune (valeursCalculees), celle que le service garde dans armure.prix
  const calculees = valeursCalculees(db).armures;
  const combinaisons = armures.filter((a) => a.sorte === 'combinaison')
    .map((a) => ({ ...a, m1: cleDeMateriau(a.materiau_ligne_id), m2: cleDeMateriau(a.materiau_colonne_id), prix_calcule: calculees.get(a.id)?.prix ?? null }));
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
    unitesParMateriau: unites,
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
