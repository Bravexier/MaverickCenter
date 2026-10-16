// Champs d'une classe et d'un don et ce que la base en tire (tables classe_maitrise_arme, classe_maitrise_armure, classe_objet_depart, colonnes
// bouclier_classe_max de classe et type / limite de capacite) : les mêmes découpages que l'importeur du classeur des classes, réécrits pour l'édition
// depuis le site de dev (client/serveur/edition.mjs). test/classe-champs.test.mjs les rejoue sur les 39 classes et les 660 dons de la base.
// Une cellule se découpe sans les balises du glossaire des mots-clés (lib/mots-cles-balises.mjs : « {{id|texte}} » se lit « texte ») ; lignesDeListe, qui
// sert aussi à l'affichage, les garde.
// Fonctions pures, sans dépendance (sauf text.mjs et mots-cles-balises.mjs).
import { texteSansBalises } from './mots-cles-balises.mjs';
import { normalize } from './text.mjs';

/** Les lignes d'une cellule de liste, sans leur tiret (« - Légère » → « Légère ») ; les lignes vides sont ignorées. */
export const lignesDeListe = (texte) =>
  String(texte ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);

/**
 * « Maîtrise Arme » : une ligne par maîtrise. « N maîtrise(s) à répartir … » → repartie ; « … au choix » → au_choix (catégorie contact / distance,
 * « (sauf X) ») ; « N maîtrise [de] <arme> » → nommee ; une ligne qui ne commence pas par « N maîtrise(s) » n'est pas typée.
 */
export function decouperMaitriseArme(texte) {
  return lignesDeListe(texteSansBalises(texte)).map((brut, i) => {
    const vide = { rang: i + 1, brut, forme: null, nombre: null, arme: null, arme_cle: null, categorie: null, sauf: null, sauf_cle: null };
    const m = /^(\d+) maîtrises? (.*)$/.exec(brut);
    if (!m) return vide;
    const reste = m[2];
    const nombre = Number(m[1]);
    if (/à répartir/.test(reste)) return { ...vide, forme: 'repartie', nombre };
    if (/au choix/.test(reste)) {
      const sauf = /\(sauf ([^)]*?)\s*\)/.exec(reste)?.[1] ?? null;
      const categorie = /\bcontact\b/.test(reste) ? 'contact' : /\bdistance\b/.test(reste) ? 'distance' : null;
      return { ...vide, forme: 'au_choix', nombre, categorie, sauf, sauf_cle: sauf === null ? null : normalize(sauf) };
    }
    const arme = reste.replace(/^de\s+/, '');
    return { ...vide, forme: 'nommee', nombre, arme, arme_cle: normalize(arme) };
  });
}

const POIDS = ['Légère', 'Intermédiaire', 'Lourde'];

/** « Maîtrise Armures » : armure « Légère » ou « Légère à Lourde » (bornes) ; « Bouclier [de] classe N [à M] » ; toute autre ligne non typée. */
export function decouperMaitriseArmure(texte) {
  return lignesDeListe(texteSansBalises(texte)).map((brut, i) => {
    const ligne = { rang: i + 1, brut, objet: null, poids_min: null, poids_max: null, classe_min: null, classe_max: null };
    const armure = /^(Légère|Intermédiaire|Lourde)(?: à (Légère|Intermédiaire|Lourde))?$/.exec(brut);
    if (armure && POIDS.includes(armure[1])) return { ...ligne, objet: 'armure', poids_min: armure[1], poids_max: armure[2] ?? armure[1] };
    const bouclier = /^Bouclier (?:de )?classe (\d)(?: à (\d))?$/.exec(brut);
    if (bouclier) return { ...ligne, objet: 'bouclier', classe_min: Number(bouclier[1]), classe_max: Number(bouclier[2] ?? bouclier[1]) };
    return ligne;
  });
}

/** classe.bouclier_classe_max : la plus haute classe de bouclier des lignes de maîtrise d'armure (NULL sans ligne bouclier). */
export const bouclierMax = (lignes) => lignes.reduce((max, l) => (l.classe_max !== null && (max === null || l.classe_max > max) ? l.classe_max : max), null);

/**
 * « Inventaire de départ » : un emplacement par objet séparé par « , », « A OU B » = deux options du même emplacement ; l'objet du glossaire
 * (objet_depart) qui porte le même nom, quantité « (xN) » retirée, ou aucun.
 * @param {{ id: string, nom_cle: string }[]} objets glossaire
 */
export function decouperInventaire(texte, objets) {
  const parCle = new Map(objets.map((o) => [o.nom_cle, o.id]));
  const lignes = [];
  String(texteSansBalises(texte ?? ''))
    .split(', ')
    .map((t) => t.trim())
    .filter(Boolean)
    .forEach((emplacement, i) => {
      emplacement.split(' OU ').forEach((option, j) => {
        const texteOption = option.trim();
        lignes.push({ rang: i + 1, option: j + 1, texte: texteOption, objet_depart_id: parCle.get(normalize(texteOption.replace(/\s*\(x\d+\)\s*$/, ''))) ?? null });
      });
    });
  return lignes;
}

/** Types de don du guide (et « Variable ») : premier mot de la cellule de type, sans accent ni casse (CHECK de capacite.type). */
export const TYPES_DE_DON = ['passif', 'actif', 'action', 'reaction', 'variable'];

/** Cellule de type d'un don : son type (premier mot reconnu) et sa limite « (N fois/période) » ou « (N/période) » ; rien d'autre n'est typé. */
export function analyserTypeDeDon(typeBrut) {
  const texte = String(texteSansBalises(typeBrut ?? '')).trim();
  const mot = normalize(texte.split(/[\s(]/)[0] ?? '');
  const limite = /\((\d+)(?: fois)?\s*\/\s*([^)]+?)\s*\)/i.exec(texte);
  return {
    type: TYPES_DE_DON.includes(mot) ? mot : null,
    limite_nombre: limite ? Number(limite[1]) : null,
    limite_periode: limite ? limite[2].toLowerCase() : null,
  };
}

/** Le mot-clé de page d'une classe selon sa catégorie (pages classes/… : c'est lui que lib/class-groups.mjs lit pour ranger la classe). */
export const MOT_CLE_DE_CATEGORIE = {
  'classe-physique-corps-a-corps': 'càc',
  'classe-physique-distance': 'distance',
  'classe-magique': 'magique',
  'classe-hybride': 'hybride',
  'classe-hybride-animal': 'hybride animal',
  'classe-speciale': 'spéciale',
};

/** La catégorie des classes raciales (classe « Hybride Animal » qui porte le nom de sa race). */
export const CATEGORIE_RACIALE = 'classe-hybride-animal';
