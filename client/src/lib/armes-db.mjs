// Page /ressources/armes/ (demande du propriétaire, 2026-10-13) : chargée depuis les tables de la base, jamais depuis son Markdown (qui ne sert plus qu'à la
// recherche et aux [[liens]] : lib/corps-armes.mjs). Un tableau par famille d'armes (bandeau de l'onglet), sans les armes de monstres (« Ne pas tenir
// compte des armes de monstres » : la famille sans maîtrise, décision R45) ; à côté, la fiche de l'arme choisie, les matériaux et les améliorations.
// Sans dépendance (sauf lib/corps-armes.mjs et lib/materiaux-couleurs.mjs, purs) : `chargerArmes` reçoit la base ouverte par lib/donnees.mjs.
import { PAGE_DES_ARMES } from './corps-armes.mjs';
import { couleurDeMateriau } from './materiaux-couleurs.mjs';

export { PAGE_DES_ARMES };

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

export { ancreDArme } from './armes-rendu.mjs';
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

/** Une partie du corps Markdown de la page : de la ligne `debut` (exclue si `sansTitre`) jusqu'au titre « ## » suivant. */
function partieDuCorps(corps, debut, { sansTitre = false } = {}) {
  const l = String(corps ?? '').split('\n');
  const i = debut === null ? -1 : l.findIndex((x) => x === debut);
  if (debut !== null && i < 0) return '';
  const depart = debut === null ? 0 : i + (sansTitre ? 1 : 0);
  let fin = l.findIndex((x, k) => k > (debut === null ? -1 : i) && /^## /.test(x));
  if (fin < 0) fin = l.length;
  return l.slice(depart, fin).join('\n').trim();
}

/**
 * Les règles de la page tirées de son corps (texte du classeur, A1 de l'onglet) : l'introduction (avant les tableaux) et « Comment déterminer le prix de
 * votre arme ? ». Rien d'autre du corps ne s'affiche : les tableaux viennent des tables.
 */
export const reglesDeLaPage = (corps) => ({
  introduction: partieDuCorps(corps, null),
  prix: partieDuCorps(corps, '## COMMENT DÉTERMINER LE PRIX DE VOTRE ARME ?', { sansTitre: true }),
});

/**
 * La phrase « Les armes en bleu sont les armes possibles en arme de départ » des règles (en gras et en bleu dans la cellule du classeur ; en gras dans le
 * Markdown de la page) prend le bleu des lignes des armes de départ : son paragraphe, rendu en HTML, reçoit la classe `armes-regles__depart`. Rien
 * d'autre ne change.
 */
export const avecPhraseDesArmesDeDepart = (html) =>
  String(html ?? '').replace(/<p>(<strong>Les armes en bleu [^<]*<\/strong>)<\/p>/, '<p class="armes-regles__depart">$1</p>');

/**
 * Les données de la page :
 *   familles      : les bandeaux (ordre de l'onglet) qui ont des armes à maîtrise, chacun { id, nom, de_brut, note_brut, cout_libelle, armes: [lignes arme] } ;
 *   materiaux     : [{ ligne (materiau_arme), nom, prix (celui de la ressource : R62), couleur: { fond, texte }, defaut (le fer) }] dans l'ordre de l'onglet ;
 *   ameliorations : les lignes amelioration_equipement de cible « arme », par niveau ;
 *   page          : { titre, resume, corps_md } de la page « Armes ».
 */
export function chargerArmes(db) {
  const armes = lignes(db, 'SELECT * FROM arme ORDER BY famille_id, ordre');
  const familles = lignes(db, 'SELECT id, nom, de_brut, note_brut, cout_libelle FROM arme_famille WHERE maitrisable = 1 ORDER BY ordre')
    .map((f) => ({ ...f, armes: armes.filter((a) => a.famille_id === f.id) }))
    .filter((f) => f.armes.length);
  // le fer : le matériau par défaut (décision R49 : « son matériau (par défaut le fer) »)
  // le prix : celui de la ressource (décision R62 : la page « Composants » est la seule source des matériaux)
  const materiaux = lignes(db, 'SELECT m.*, r.nom, r.nom_cle, r.prix_brut AS prix_ressource FROM materiau_arme m JOIN ressource r ON r.id = m.ressource_id ORDER BY m.ordre')
    .map(({ nom, nom_cle, prix_ressource, ...ligne }) => ({ ligne, nom, prix: prix_ressource ?? ligne.prix_brut, couleur: couleurDeMateriau(ligne.ressource_id), defaut: nom_cle === 'fer' }));
  const ameliorations = lignes(db, "SELECT * FROM amelioration_equipement WHERE cible = 'arme' ORDER BY niveau");
  const page = db.prepare('SELECT titre, resume, corps_md FROM page WHERE id = ?').get(PAGE_DES_ARMES) ?? null;
  return { familles, materiaux, ameliorations, page: page ? { ...page } : null };
}
