// Rendu HTML du tableau des bâtons magiques, sous-onglet « Bâtons magiques » de l'onglet « Ceinture » de la page /ressources/equipement/
// (components/ceinture/BatonsMagiques.astro ; données : lib/batons-db.mjs). Demande du propriétaire du 2026-10-16 : « colorer toute la ligne de la
// couleur de la magie concernée. La colonne magie elle même n'est pas utile. Il faudra un tooltip pour donner le lien vers l'objet de la gemme ou et du
// bois utilisé. Il faudrait une colonne "niveau" avec un slider de 1 à 3 à chaque fois. La case de la colonne "effet" se mettra à jour en fonction du
// niveau. Rajouter une colonne pour le prix. »
// Une ligne par magie, sur la couleur de sa magie dans l'onglet « Bâton magique » du classeur (la case du nom de la magie : lib/ceinture-couleurs.mjs ;
// demande du propriétaire du 2026-10-16 : « récupérer les couleurs utilisé dans les tableaux du GoogleSheet pour les lignes présentes » ; une magie
// absente de l'onglet garde la couleur du site, sort-format.mjs#couleurDeMagie) : Gemme | Bois | Niveau | Effet | Prix. La gemme et le bois mènent à
// leur ligne de la page « Composants » et ont chacun leur infobulle (description, prix, le même lien) ; la gemme est la pastille des accessoires
// (`.acc-gemme`, dans la couleur de sa magie sur le site, styles/equipement/equipement.css), sans ligne pour sa qualité (demande du propriétaire du
// 2026-10-16 : « La case des gemmes doit utiliser le même item que pour les accessoire. Une pastille. Et pas de 2em ligne pour la qualité de la
// gemme » ; la qualité du niveau reste en avant dans l'infobulle). L'effet (le bonus tel qu'écrit) et le prix (lib/batons-db.mjs#prixDuBaton) sont
// écrits pour chaque niveau (`data-niv`), le CSS n'affiche que ceux du niveau de la ligne (`data-niveau`, que le curseur change : src/scripts/batons.mjs) ;
// sans JavaScript, tout est affiché, chaque niveau sous son nom. Rien d'autre n'est calculé. Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import { ancreDeComposant } from './composants-rendu.mjs';
import { couleursDeLaLigne, htmlDeLignes, htmlDePrix } from './ceinture-rendu.mjs';
import { couleurDesBatons } from './ceinture-couleurs.mjs';
import { htmlDeMontant, MONNAIES_DU_JEU } from './monnaies.mjs';
import { couleurDeMagie, texteSurCouleur } from './sort-format.mjs';
import { prixDuBaton, QUALITES_DE_GEMME } from './batons-db.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide" aria-label="aucun">—</span>';

/** Ancre de la ligne des bâtons d'une magie : « baton-magie-du-feu » pour « magies/magie-du-feu ». */
export const ancreDeBatons = (magieId) => `baton-${String(magieId).replace(/^.*\//, '')}`;

/** Identifiant de l'infobulle de la gemme (`gemme`) ou du bois (`bois`) d'une ligne : unique sur la page (une ligne par magie). */
export const bulleDeBatons = (magieId, quoi) => `bulle-${ancreDeBatons(magieId)}-${quoi}`;

/** Un montant en Ricken de fer, en icônes : en Ricken d'or quand il en tombe un nombre entier (les prix de la source), sinon en Ricken de fer. */
export function htmlDuPrixDuBaton(rf) {
  if (!Number.isInteger(rf)) return VIDE;
  const ro = MONNAIES_DU_JEU.RO.valeur_rf;
  return rf % ro === 0 ? htmlDeMontant(String(rf / ro), 'RO') : htmlDeMontant(String(rf), 'RF');
}

/** Ce qu'une case écrit pour chaque niveau : un bloc par niveau (`data-niv`), son nom devant (affiché sans JavaScript seulement). */
const parNiveau = (niveaux, html) =>
  niveaux.map((n) => `<span class="baton-niv" data-niv="${n.niveau}"><span class="baton-niv__nom">Niveau ${n.niveau} : </span>${html(n.niveau)}</span>`).join('');

/** L'infobulle d'une gemme ou d'un bois : son nom, sa magie, sa description, ses prix et le lien vers sa ligne de « Composants » (hors tabulation : le nom l'est). */
const htmlDeBulle = (id, c, sous, prix, lien) =>
  `<span class="bulle bulle--baton" role="tooltip" id="${e(id)}" hidden><strong class="bulle__titre">${e(c.nom)}</strong><span class="bulle__sous">${e(sous)}</span>`
  + (c.description ? `<span class="bulle__texte">${e(c.description)}</span>` : '')
  + prix
  + `<a class="bulle__lien" href="${e(lien)}" tabindex="-1">Voir dans Composants</a></span>`;

/** Le nom du bois, en lien vers sa ligne de « Composants », qui ouvre son infobulle. */
const htmlDuNom = (c, lien, bulle) => `<a class="baton__nom" href="${e(lien)}" data-bulle="${e(bulle)}" aria-describedby="${e(bulle)}">${e(c.nom)}</a>`;

/**
 * La gemme d'une ligne : la pastille des accessoires (`.acc-gemme` dans la couleur de la magie, ici un lien vers « Composants ») et son infobulle
 * (le prix de la gemme entière de chaque qualité, celle du niveau de la ligne en avant).
 */
function htmlDeGemme(m, niveaux, adresseDesComposants) {
  const g = m.gemme;
  if (!g) return VIDE;
  const lien = `${adresseDesComposants}#${ancreDeComposant(g.id)}`;
  const bulle = bulleDeBatons(m.magie.id, 'gemme');
  const fond = couleurDeMagie(m.magie.nom);
  const pastille = `<a class="acc-gemme" href="${e(lien)}" style="--g: ${fond}; --g-texte: ${texteSurCouleur(fond)}" data-bulle="${e(bulle)}" aria-describedby="${e(bulle)}">${e(g.nom)}</a>`;
  const stades = niveaux
    .filter((n) => m.qualites?.[n.niveau])
    .map((n) => `<span class="bulle__stade" data-niv="${n.niveau}"><span class="bulle__stade-nom">${e(QUALITES_DE_GEMME[m.qualites[n.niveau]].replace(/^Gemme /, ''))}</span><span>${htmlDePrix(g.prix?.[m.qualites[n.niveau]]?.brut)}</span></span>`)
    .join('');
  const prix = stades ? `<span class="bulle__stades">${stades}</span>` : '';
  return `${pastille}${htmlDeBulle(bulle, g, `Gemme précieuse · ${m.magie.nom}`, prix, lien)}`;
}

/** Le bois d'une ligne : son nom et son infobulle (son prix). */
function htmlDeBois(m, adresseDesComposants) {
  const b = m.bois;
  if (!b) return VIDE;
  const lien = `${adresseDesComposants}#${ancreDeComposant(b.id)}`;
  const bulle = bulleDeBatons(m.magie.id, 'bois');
  const prix = `<span class="bulle__texte">Prix : ${htmlDePrix(b.prix?.brut)}</span>`;
  return `${htmlDuNom(b, lien, bulle)}${htmlDeBulle(bulle, b, `Bois · ${m.magie.nom}`, prix, lien)}`;
}

/** Le curseur du niveau de la ligne (affiché avec JavaScript seulement) ; sans JavaScript, les niveaux écrits (« 1 à 3 »). */
function htmlDuNiveau(m, niveaux) {
  const min = niveaux[0]?.niveau ?? 1;
  const max = niveaux.at(-1)?.niveau ?? min;
  return `<span class="baton-curseur js-seul"><input type="range" class="baton-curseur__champ" min="${min}" max="${max}" step="1" value="${min}" data-baton-curseur`
    + ` aria-label="${e(`Niveau du bâton : ${m.magie.nom}`)}" aria-valuetext="${e(`Niveau ${min}`)}" />`
    + `<output class="baton-curseur__valeur" data-baton-niveau aria-hidden="true">${min}</output></span>`
    + `<span class="sans-js">${min === max ? min : `${min} à ${max}`}</span>`;
}

/**
 * Les couleurs de la ligne des bâtons d'une magie, { fond, texte } : la case de la magie dans l'onglet « Bâton magique » (lib/ceinture-couleurs.mjs),
 * sinon la couleur de la magie sur le site.
 */
export function couleursDesBatons(magie) {
  return couleursDeLaLigne(couleurDesBatons(magie.id)) ?? couleursDeLaLigne({ fond: couleurDeMagie(magie.nom) });
}

/**
 * Les bâtons d'une magie (`m` : une entrée de `chargerBatons(db).magies`), sur la couleur de la magie (couleursDesBatons : `--baton-fond`,
 * `--baton-texte`) : Gemme (en-tête de la ligne, le nom de la magie pour les lecteurs d'écran) | Bois | Niveau (le curseur) | Effet | Prix, l'effet et
 * le prix de chaque niveau (`niveaux` : [{ niveau }]) ; la ligne s'ouvre au premier niveau (`data-niveau`). `--mag`, la couleur de la magie sur le site,
 * reste la teinte des infobulles de la ligne (styles/global/infobulles.css), comme la pastille de la gemme : un fond du classeur presque blanc
 * (Arcane, Vide, Lumière) n'efface pas leur filet.
 */
export function htmlDeLigneDeBatons(m, niveaux, adresseDesComposants) {
  const { fond, texte } = couleursDesBatons(m.magie);
  return `<tr class="baton ligne-couleur" id="${e(ancreDeBatons(m.magie.id))}" data-niveau="${niveaux[0]?.niveau ?? 1}" style="--baton-fond: ${e(fond)}; --baton-texte: ${e(texte)}; --mag: ${e(couleurDeMagie(m.magie.nom))}">`
    + `<th scope="row" class="baton__gemme"><span class="baton__magie">${e(m.magie.nom)} : </span>${htmlDeGemme(m, niveaux, adresseDesComposants)}</th>`
    + `<td class="baton__bois">${htmlDeBois(m, adresseDesComposants)}</td>`
    + `<td class="baton__niveau">${htmlDuNiveau(m, niveaux)}</td>`
    + `<td class="baton__effet">${parNiveau(niveaux, (n) => htmlDeLignes(m.bonus[n]))}</td>`
    + `<td class="baton__prix">${parNiveau(niveaux, (n) => htmlDuPrixDuBaton(prixDuBaton(m, n)))}</td>`
    + '</tr>';
}
