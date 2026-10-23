// Onglet Armes de la page /ressources/equipement/ (avant, la page /ressources/armes/ ; demande du propriétaire, 2026-10-13) : chargée depuis les
// tables de la base, jamais depuis son Markdown (qui ne sert plus qu'à la recherche et aux [[liens]] : lib/corps-armes.mjs). Un tableau par famille
// d'armes (bandeau de l'onglet), sans les armes de monstres (« Ne pas tenir compte des armes de monstres » : la famille sans maîtrise, décision
// R45) ; à côté, la fiche de l'arme choisie, les matériaux et les améliorations. Les armes élémentaires (décision R167, migration 0081) sont listées
// dans le tableau de leur famille (familles[].armes_elementaires), avec la colonne de coût élémentaire du tableau d'amélioration.
// Sans dépendance (sauf lib/corps-armes.mjs, pur) : `chargerArmes` reçoit la base ouverte par lib/donnees.mjs.
import { PAGE_DES_ARMES } from './corps-armes.mjs';

export { PAGE_DES_ARMES };

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

// le rendu de l'onglet (lib/armes-rendu.mjs) : l'ancre d'une arme, la phrase des armes de départ dans le panneau de règles
export { ancreDArme, avecPhraseDesArmesDeDepart } from './armes-rendu.mjs';
/** Ancre HTML d'un matériau : « materiau-titane ». */
export const ancreDeMateriau = (id) => `materiau-${String(id).slice(String(id).lastIndexOf(':') + 1)}`;

/**
 * Les listes dont les rendus des cellules ont besoin (lib/armes-rendu.mjs) : les mêmes que le service donne au mode modification
 * (serveur/edition.mjs#listes) — compétences et caractéristiques (couleur et infobulle de la compétence), types d'armes (libellé, dé, règle du dé,
 * portée par défaut ; aussi la liste du champ « Type »), solidité de base des armes (constante de l'onglet).
 */
export function contexteDesArmes(db) {
  return {
    competences: lignes(db, 'SELECT id, nom, caracteristique_id, ordre FROM competence ORDER BY ordre'),
    caracteristiques: lignes(db, 'SELECT id, nom FROM caracteristique ORDER BY ordre'),
    typesDArmes: lignes(db, 'SELECT id AS valeur, nom AS libelle, de, de_regle, portee_min, portee_max FROM arme_type ORDER BY nom'),
    soliditeDesArmes: db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'arme.solidite_base'").get()?.valeur ?? null,
  };
}

/** Les qualités des gemmes d'un coût élémentaire (amelioration_equipement.cout_gemmes_qualite), dans l'ordre du tableau. */
export const QUALITES_DES_GEMMES = Object.freeze(['commune', 'raffinee', 'parfaite']);

/**
 * Le coût élémentaire cumulé de chaque niveau d'amélioration d'arme (décision R167 : « le coût est cumulatif (du 0 au +2 : 1 + 2 = 3 gemmes communes),
 * l'effet est celui de la ligne ») : pour le niveau N, la somme des lignes 1 à N, par qualité de gemme, et les pièces élémentaires. `ameliorations` : les
 * lignes de cible « arme », dans l'ordre des niveaux. Rend [{ niveau, gemmes: { commune, raffinee, parfaite }, pieces_elementaires }].
 */
export function coutsElementairesCumules(ameliorations) {
  const total = { gemmes: Object.fromEntries(QUALITES_DES_GEMMES.map((q) => [q, 0])), pieces_elementaires: 0 };
  return [...ameliorations].sort((a, b) => a.niveau - b.niveau).map((a) => {
    if (a.cout_gemmes_qualite) total.gemmes[a.cout_gemmes_qualite] += a.cout_gemmes ?? 0;
    total.pieces_elementaires += a.cout_pieces_elementaires ?? 0;
    return { niveau: a.niveau, gemmes: { ...total.gemmes }, pieces_elementaires: total.pieces_elementaires };
  });
}

/**
 * Les données de la page :
 *   familles      : les bandeaux à maîtrise (ordre de l'onglet), même sans arme (une famille créée sur le site de dev, R159), chacun { id, nom, de_brut, note_brut,
 *                   cout_libelle, categorie, armes: [lignes arme], type_elementaire, armes_elementaires } ;
 *                   categorie : 'contact' ou 'distance' (arme_famille.categorie, décision R127) — les deux menus à onglets de l'onglet Armes la groupent ;
 *                   type_elementaire : le type des armes élémentaires de la famille (décision R167 : « la transformation suit la famille sous laquelle l'arme
 *                   est listée », arme_famille.type_elementaire_id) : { id, nom, de, de_regle, portee_min, portee_max (arme_type : « Dé et portée : ceux de
 *                   son type »), ignore_ap (« ignore 4 AP » de l'Arbalète, null sinon), exemplaire_unique (Arme de jet, Bombe : « en un seul exemplaire,
 *                   sans coût à l'unité »), mention (telle qu'écrite, null sinon), competences (ids au choix du porteur, dans l'ordre de la table
 *                   competence), types_degats (ses types physiques, arme_elementaire_type_degats, dans l'ordre alphabétique : « Les deux », le type
 *                   physique de la famille et celui de la magie, R167), type_degats_au_choix (vrai : le porteur en choisit un, la Bombe ; faux : tous
 *                   s'appliquent) } ; null sans type ;
 *                   armes_elementaires : ses armes élémentaires, une par magie (pas de Potentiel Illimité), dans l'ordre de arme_elementaire.ordre, chacune
 *                   { id, nom, type_id, magie_id, magie (son nom), bonus_degats (« +8 Dégâts »), capacite_nom, capacite_mode, capacite_texte, remarque,
 *                   gemme: { id, nom } (la gemme de sa magie, table gemme : « les gemmes sont celles de la magie », R167 ; null si la magie n'en a pas) } ;
 *   materiaux     : [{ ligne (materiau_arme), nom, prix (celui de la ressource : R62), defaut (le fer) }] dans l'ordre de l'onglet ;
 *   ameliorations : les lignes amelioration_equipement de cible « arme », par niveau : UN tableau pour l'arme du catalogue et l'arme élémentaire (décision
 *                   R167, migration 0081), le coût matériel (cout_brut, cout_ro, cout_materiaux) et le coût élémentaire (cout_elementaire_brut, cout_gemmes,
 *                   cout_gemmes_qualite, cout_pieces_elementaires) de chaque niveau, et son effet (bonus_degats, bonus_cran) ;
 *   couts_elementaires : le coût élémentaire cumulé du 0 au +N, par niveau (coutsElementairesCumules) ;
 *   solidite_elementaire : la solidité de base d'une arme élémentaire (constante_equipement « piece_elementaire.solidite_base », celle de toute pièce élémentaire ; R167 : « 4 crans + les
 *                   crans de la ligne d'amélioration choisie ») ;
 *   page          : { titre, resume, corps_md } de la page « Armes ».
 */
export function chargerArmes(db) {
  const armes = lignes(db, 'SELECT * FROM arme ORDER BY famille_id, ordre');
  const competencesDesTypes = lignes(db, `SELECT c.type_id, c.competence_id FROM arme_elementaire_type_competence c JOIN competence k ON k.id = c.competence_id
                                          ORDER BY c.type_id, k.ordre`);
  const degatsDesTypes = lignes(db, 'SELECT type_id, type_degats FROM arme_elementaire_type_degats ORDER BY type_id, type_degats');
  const types = new Map(lignes(db, `SELECT e.type_id AS id, t.nom, t.de, t.de_regle, t.portee_min, t.portee_max, e.ignore_ap, e.exemplaire_unique, e.mention,
                                           e.type_degats_au_choix
                                    FROM arme_elementaire_type e JOIN arme_type t ON t.id = e.type_id ORDER BY e.ordre`)
    .map((t) => [t.id, {
      ...t, exemplaire_unique: t.exemplaire_unique === 1, competences: competencesDesTypes.filter((c) => c.type_id === t.id).map((c) => c.competence_id),
      types_degats: degatsDesTypes.filter((d) => d.type_id === t.id).map((d) => d.type_degats), type_degats_au_choix: t.type_degats_au_choix === 1,
    }]));
  const elementaires = lignes(db, `SELECT e.id, e.nom, e.type_id, e.magie_id, m.nom AS magie, e.bonus_degats, e.capacite_nom, e.capacite_mode, e.capacite_texte, e.remarque,
                                          g.ressource_id AS gemme_id, r.nom AS gemme_nom
                                   FROM arme_elementaire e JOIN magie m ON m.id = e.magie_id
                                   LEFT JOIN gemme g ON g.magie_id = e.magie_id LEFT JOIN ressource r ON r.id = g.ressource_id
                                   ORDER BY e.ordre`)
    .map(({ gemme_id, gemme_nom, ...e }) => ({ ...e, gemme: gemme_id ? { id: gemme_id, nom: gemme_nom } : null }));
  // toutes les familles à maîtrise, même sans arme : une famille créée sur le site de dev (décision R159) a son onglet et son tableau dès sa création ;
  // elle n'a aucune arme élémentaire (type_elementaire_id NULL : décision R167)
  const familles = lignes(db, 'SELECT id, nom, de_brut, note_brut, cout_libelle, categorie, type_elementaire_id FROM arme_famille WHERE maitrisable = 1 ORDER BY ordre')
    .map(({ type_elementaire_id, ...f }) => ({
      ...f, armes: armes.filter((a) => a.famille_id === f.id),
      type_elementaire: types.get(type_elementaire_id) ?? null,
      armes_elementaires: type_elementaire_id ? elementaires.filter((e) => e.type_id === type_elementaire_id) : [],
    }));
  // le fer : le matériau par défaut (décision R49 : « son matériau (par défaut le fer) »)
  // le prix : celui de la ressource (décision R62 : la page « Composants » est la seule source des matériaux)
  const materiaux = lignes(db, 'SELECT m.*, r.nom, r.nom_cle, r.prix_brut AS prix_ressource FROM materiau_arme m JOIN ressource r ON r.id = m.ressource_id ORDER BY m.ordre')
    .map(({ nom, nom_cle, prix_ressource, ...ligne }) => ({ ligne, nom, prix: prix_ressource ?? ligne.prix_brut, defaut: nom_cle === 'fer' }));
  const ameliorations = lignes(db, "SELECT * FROM amelioration_equipement WHERE cible = 'arme' ORDER BY niveau");
  const solidite = db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").get();
  const page = db.prepare('SELECT titre, resume, corps_md FROM page WHERE id = ?').get(PAGE_DES_ARMES) ?? null;
  return {
    familles, materiaux, ameliorations, couts_elementaires: coutsElementairesCumules(ameliorations), solidite_elementaire: solidite?.valeur ?? null,
    page: page ? { ...page } : null,
  };
}
