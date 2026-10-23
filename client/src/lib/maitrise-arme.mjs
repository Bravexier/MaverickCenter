// Maîtrises d'armes écrites en toutes lettres dans la base, lues pour la fiche de personnage (lib/fiche-regles.mjs, au build) et pour les tables de
// règles des sources de maîtrise :
//   - le dé d'une famille d'armes qui dépend de la Force (Pugilat : « D6 1-2 Force, D8 3-4 Force, D10 5 Force », arme_famille.note_brut) ;
//   - les sources de maîtrise d'arme (décisions R148 à R151) : ce que donne chaque ligne de classe_maitrise_arme et chaque don, en parts (une famille
//     imposée, des points à choisir parmi des familles, ou la famille suivie de la maîtrise au choix de la classe) ;
//   - les NM de sorts qu'un don fait gagner (« Gagne 4 niveaux de maîtrise (NM). », décision R154).
// Rien n'est déduit : seul ce que le texte écrit compte, jamais le nom du don ni celui de la classe. Les balises du glossaire (« {{id|texte}} ») sont
// lues par leur texte écrit, comme dans les découpages (lib/mots-cles-balises.mjs#texteSansBalises, sans vocabulaire).
// Pur, sans dépendance (sauf text.mjs et mots-cles-balises.mjs).
import { texteSansBalises } from './mots-cles-balises.mjs';
import { normalize } from './text.mjs';

const plier = (texte) => String(texteSansBalises(texte ?? '') ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’`]/g, "'").toLowerCase();

/**
 * Paliers du dé selon la Force écrits dans une note (« D6 1-2 Force, D8 3-4 Force, D10 5 Force ») : [{ de: 'D6', min: 1, max: 2 }, …], dans l'ordre
 * du texte ; null quand la note n'en écrit aucun.
 */
export function desSelonLaForce(note) {
  const paliers = [...plier(note).matchAll(/\b(d\d+)\s+(\d+)(?:\s*-\s*(\d+))?\s+force\b/g)]
    .map((m) => ({ de: m[1].toUpperCase(), min: Number(m[2]), max: Number(m[3] ?? m[2]) }));
  return paliers.length ? paliers : null;
}

// « N point(s) de maîtrise … », « N maîtrise(s) … », avec son signe (« -1 point de maîtrise de l'autre arme choisie » de l'Épéiste en retire un) ; une
// limite (« pas plus de 2 points de maîtrise répartis… ») n'en est pas une ; un niveau de maîtrise de sort (« 4 niveaux de maîtrise (NM) ») ne s'écrit
// pas ainsi (lireDon)
const POINTS_DE_MAITRISE = /([+\-−]?)\s*(\d+)\s+(?:points?\s+de\s+)?maitrises?\b/g;
const occurrences = (t) => [...t.matchAll(POINTS_DE_MAITRISE)].filter((m) => !/plus de\s*$/.test(t.slice(0, m.index)));
const signe = (m) => (m[1] && m[1] !== '+' ? -1 : 1);

/**
 * NM de sorts gagnés qu'écrit le texte d'un don (décision R154) : le N de « Gagne N niveaux de maîtrise (NM) » (Ocultomancien « Maîtrise » : « Gagne 4
 * niveaux de maîtrise (NM). »), la somme s'il l'écrit plusieurs fois ; 0 sinon. Rien d'autre n'en donne : « Donne un NM supplémentaire au sort préparé »
 * (« À l'aise », R134) ne change pas les NM gagnés.
 */
export function nmGagnesDuDon(texte) {
  return [...plier(texte).matchAll(/\bgagne\s+(\d+)\s+niveaux?\s+de\s+maitrise\s*\(\s*nm\s*\)/g)].reduce((n, m) => n + Number(m[1]), 0);
}

/**
 * Les « sauf » d'une maîtrise au choix (classe_maitrise_arme.sauf_cle) et les noms des lignes nommées (classe_maitrise_arme.arme_cle) écrits autrement
 * que le bandeau de leur famille, et la famille (arme_famille.id) qu'ils désignent : décision R138 (question Q44, « Oui c'est les familles ») — « Hast » :
 * LANCE/ARME D'HAST, « Bâton » : BÂTON DE COMBAT, « Arme jet » : ARME DE JET, « Masse » : MASSE/MARTEAU ; décision R151 pour les lignes nommées
 * (« chaque nom désigne sa famille, comme pour R138 » : « Hast », « Bâton », « Arme Jet », « Masse » ici, « Arme de jet » et « Bombe » par leur bandeau).
 * Les autres noms (« Dague », « Épée », « Arc »…) nomment leur famille par son bandeau, tel quel ou au singulier, ce que R138 confirme (« Épée » : ÉPÉES) :
 * famillesDuNom les lit ainsi.
 */
export const FAMILLES_DES_SAUF = Object.freeze({ hast: 'lance-arme-dhast', baton: 'baton-de-combat', 'arme-jet': 'arme-de-jet', masse: 'masse-marteau' });

const singulier = (cle) => cle.split('-').map((m) => m.replace(/(?<=[a-z]{3})s$/, '')).join('-');
const sansDe = (cle) => cle.split('-').filter((m) => m !== 'de' && m !== 'd').join('-');
const maitrisables = (familles) => familles.filter((f) => f.maitrisable && f.maitrisable !== '0');

/**
 * Les familles (arme_famille.id, dans l'ordre de `familles`) que désigne un nom écrit : celle que lui rattache FAMILLES_DES_SAUF (R138, R151), sinon
 * celles dont le bandeau, chaque nom séparé par « / », s'écrit pareil tel quel ou au singulier (« Dague » : DAGUES ; « Épée » : ÉPÉES ; « MASSE/MARTEAU »
 * se lit « Masse » ou « Marteau »), sinon celles qui s'écrivent pareil sans « de » (« Bâton combat » : BÂTON DE COMBAT, la ligne du Frappeur) ; [] quand
 * le nom ne désigne aucune famille (rien n'est rapproché à la place de la source).
 * @param {string} nom @param {{ id: string, nom: string }[]} familles
 */
export function famillesDuNom(nom, familles) {
  const cle = normalize(nom ?? '');
  if (!cle) return [];
  const rattachee = FAMILLES_DES_SAUF[cle];
  if (rattachee) return familles.filter((f) => f.id === rattachee).map((f) => f.id);
  const noms = (f) => String(f.nom).split('/').map((n) => normalize(n));
  const parBandeau = familles.filter((f) => noms(f).some((n) => singulier(n) === singulier(cle)));
  if (parBandeau.length) return parBandeau.map((f) => f.id);
  return familles.filter((f) => noms(f).some((n) => singulier(sansDe(n)) === singulier(sansDe(cle)))).map((f) => f.id);
}

/**
 * Les familles d'une maîtrise au choix d'une classe (classe_maitrise_arme forme 'au_choix', décision R119) : les familles maîtrisables (jamais ARME DE
 * MONSTRES, R45) de sa catégorie (« arme contact au choix », « arme à distance au choix » : R127 ; aucune catégorie écrite : toutes), sans celle de son
 * « sauf » (« (sauf Dague) », lu par famillesDuNom, R138) ; null quand le « sauf » ne nomme aucune famille de la catégorie (la maîtrise ne se lit pas).
 * @param {{ categorie?: string|null, sauf_cle?: string|null }} ligne
 * @param {{ id: string, nom: string, maitrisable: boolean|number, categorie: string|null }[]} familles arme_famille, dans son ordre
 */
export function famillesAuChoix(ligne, familles) {
  const candidates = maitrisables(familles).filter((x) => !ligne.categorie || x.categorie === ligne.categorie);
  if (!ligne.sauf_cle) return candidates.map((x) => x.id);
  const nommees = new Set(famillesDuNom(ligne.sauf_cle, familles));
  const exclues = candidates.filter((x) => nommees.has(x.id));
  return exclues.length ? candidates.filter((x) => !exclues.includes(x)).map((x) => x.id) : null;
}

/** Identifiant d'une source de maîtrise qui est une ligne de classe_maitrise_arme (un don a pour identifiant celui de sa capacité). */
export const idDeSourceDeClasse = (classeId, rang) => `${classeId}#maitrise-arme:${rang}`;

/*
 * Une source de maîtrise se lit en parts, dans l'ordre de son texte (rang 1, 2…) :
 *   { rang, genre: 'imposee', points, famille, options: [], limite: null }    une famille fixe, sans sélecteur ;
 *   { rang, genre: 'choix', points, famille: null, options, limite }          `points` sélecteurs d'un point, chacun parmi `options` (ids, dans l'ordre
 *                                                                              d'arme_famille), au plus `limite` points de la part sur une même famille
 *                                                                              (null : rien d'écrit, R150) ;
 *   { rang, genre: 'suit', points, famille: null, options: [], limite: null } la famille choisie pour la ligne `au_choix` de la classe du don (R151).
 * `points` est un entier signé, jamais 0 (le −1 de l'Épéiste). Ce qui s'écrit sans se lire (un nom qui ne désigne aucune famille) n'est pas une part :
 * il est rendu, tel qu'écrit, dans `non_lues` (absente quand tout se lit).
 */
const imposee = (points, famille) => ({ genre: 'imposee', points, famille, options: [], limite: null });
const choix = (points, options, limite = null) => ({ genre: 'choix', points, famille: null, options, limite });
const suit = (points) => ({ genre: 'suit', points, famille: null, options: [], limite: null });
const rangees = (parts) => parts.map((p, i) => ({ rang: i + 1, ...p }));
const avecNonLues = (source, nonLues) => (nonLues.length ? { ...source, non_lues: nonLues } : source);
const parCategorie = (familles, categorie) => maitrisables(familles).filter((f) => f.categorie === categorie).map((f) => f.id);
/** La famille maîtrisable unique que désigne un nom, ou null. */
const familleNommee = (nom, familles) => {
  const ids = famillesDuNom(nom, maitrisables(familles));
  return ids.length === 1 ? ids[0] : null;
};
/** La catégorie (R127) qu'écrit une destination : « contact », « corps à corps » (R151) ; « distance » ; null sinon. */
const categorieEcrite = (t) => (/\bcontact\b|\bcorps a corps\b/.test(t) ? 'contact' : /\bdistance\b/.test(t) ? 'distance' : null);

/**
 * Ce que donne une ligne de classe_maitrise_arme (décisions R148, R151) :
 *   - `nommee` (« 1 maîtrise Épée ») : une part imposée, la famille que désigne son arme (famillesDuNom : le bandeau, ou FAMILLES_DES_SAUF) ;
 *   - `au_choix` (« 1 maîtrise au choix (sauf Épée) ») : une part à choisir de `nombre` points parmi famillesAuChoix (R127, R138) ;
 *   - `repartie` (« 2 maîtrises à répartir… ») : une part à choisir de `nombre` points, parmi les familles qu'écrit la ligne (« entre Masse, Pugilat,
 *     Bâton combat »), celles de sa catégorie (« corps à corps » = contact, R151), ou toutes, avec la limite écrite par famille (« sans dépasser 1 dans
 *     le même », « (1 maximum dans une seule) », R150).
 * null pour une ligne non typée (nombre NULL).
 * @param {{ forme: string|null, nombre: number|null, brut: string, arme?: string|null, arme_cle?: string|null, categorie?: string|null, sauf_cle?: string|null }} ligne
 * @param {{ id: string, nom: string, maitrisable: boolean|number, categorie: string|null }[]} familles arme_famille, dans son ordre
 */
export function lireLigneDeClasse(ligne, familles) {
  if (ligne.nombre === null || ligne.nombre === undefined || !ligne.forme) return null;
  const { forme, nombre } = ligne;
  if (forme === 'nommee') {
    const famille = familleNommee(ligne.arme ?? ligne.arme_cle, familles);
    return famille ? { forme, parts: rangees([imposee(nombre, famille)]) } : { forme, parts: [], non_lues: [ligne.brut] };
  }
  if (forme === 'au_choix') {
    const options = famillesAuChoix(ligne, familles);
    return options ? { forme, parts: rangees([choix(nombre, options)]) } : { forme, parts: [], non_lues: [ligne.brut] };
  }
  if (forme === 'repartie') {
    const t = plier(ligne.brut);
    const limite = /\bsans depasser\s+(\d+)\b/.exec(t)?.[1] ?? /\b(\d+)\s+maximum\b/.exec(t)?.[1] ?? null;
    const entre = /\bentre\s+([^()]*)/.exec(t)?.[1];
    const categorie = categorieEcrite(t);
    let options;
    if (entre) {
      const noms = entre.split(/,|\bet\b|\bou\b/).map((n) => n.trim()).filter(Boolean);
      const ids = noms.map((n) => familleNommee(n, familles));
      if (ids.includes(null)) return { forme, parts: [], non_lues: [ligne.brut] };
      options = maitrisables(familles).map((f) => f.id).filter((id) => ids.includes(id));
    } else {
      options = categorie ? parCategorie(familles, categorie) : maitrisables(familles).map((f) => f.id);
    }
    return { forme, parts: rangees([choix(nombre, options, limite === null ? null : Number(limite))]) };
  }
  return { forme, parts: [], non_lues: [ligne.brut] };
}

/*
 * Les formes d'un don, selon ce qu'écrit son texte (le tableau « Dons » du cahier des charges de la refonte, décisions R150, R151) :
 *   a_repartir           « N points de maîtrise (d'arme) à répartir », sans limite écrite : une part à choisir parmi toutes les familles maîtrisables ;
 *   a_repartir_limite    la même, avec sa limite écrite par famille (« Pas plus de 2 points… dans la même catégorie », « plus de 3 points dans une
 *                        catégorie interdit » : « catégorie » = famille, R150) ;
 *   sans_destination     « +2 points de maîtrise d'arme », « +1 point de maîtrise. » : comme à répartir (R150) ;
 *   nommee               « +2 points de maîtrise Arcs », « +1 maîtrise Dague » : des familles imposées ;
 *   nommee_et_categorie  « +2 points de maîtrise Arme de jet, +1 point de maîtrise Arme contact au choix » : imposée, puis à choisir dans la catégorie ;
 *   categorie            « +1 point de maîtrise d'arme de contact », « … à distance au choix » : à choisir parmi les familles de la catégorie (R127) ;
 *   suit                 « +2 points de maîtrise avec l'arme déterminée avant » : la famille de la maîtrise au choix de la classe (R151) ;
 *   nommee_et_retrait    « 2 points de maîtrise à l'épée, 1 point de maîtrise à la dague, -1 point de maîtrise de l'autre arme choisie » : imposées,
 *                        puis un retrait sur la famille suivie (R151) ;
 *   mixte                tout autre assemblage (aucun don de la base : test/maitrise-arme.test.mjs).
 */
const FORMES_DES_DONS = new Map([
  ['repartir', (parts) => (parts[0].limite === null ? 'a_repartir' : 'a_repartir_limite')],
  ['sans_destination', () => 'sans_destination'],
  ['nommee', () => 'nommee'],
  ['categorie', () => 'categorie'],
  ['suit', (parts) => (parts[0].points > 0 ? 'suit' : 'mixte')],
  ['nommee+categorie', () => 'nommee_et_categorie'],
  ['nommee+suit', (parts) => (parts.find((p) => p.genre === 'suit').points < 0 ? 'nommee_et_retrait' : 'mixte')],
]);

/**
 * Ce que donne le texte d'un don en points de maîtrise d'arme (décisions R148, R150, R151) : { forme, parts } (formes : FORMES_DES_DONS ci-dessus ; parts :
 * voir plus haut), avec `non_lues` quand une écriture ne se lit pas ; null quand le texte ne donne aucun point de maîtrise d'arme (« Encore plus ! »,
 * « Sournois », « Sur le Pouce » s'en servent sans en donner ; « Gagne 4 niveaux de maîtrise (NM) » porte sur les sorts : nmGagnesDuDon).
 * Chaque « N point(s) de maîtrise <destination> » est une part, dans l'ordre du texte ; la destination est ce qui suit, jusqu'à la virgule, au point
 * ou à la parenthèse ; la limite écrite (entre parenthèses) vaut pour la part qu'elle suit.
 * @param {string} effet capacite.effet
 * @param {{ id: string, nom: string, maitrisable: boolean|number, categorie: string|null }[]} familles arme_famille, dans son ordre
 */
export function lireDon(effet, familles) {
  const t = plier(effet);
  const trouvees = occurrences(t);
  if (!trouvees.length) return null;
  const toutes = maitrisables(familles).map((f) => f.id);
  const parts = [];
  const sortes = [];
  const nonLues = [];
  trouvees.forEach((m, i) => {
    const points = signe(m) * Number(m[2]);
    const suite = t.slice(m.index + m[0].length, trouvees[i + 1]?.index ?? t.length);
    const destination = suite.split(/[,.;:\n(]/)[0].trim();
    const ecrit = (m[0] + (destination ? ` ${destination}` : '')).trim();
    if (points === 0) return;
    const limite = /\bplus de\s+(\d+)\s+points?\b[^)]*?\b(?:meme|une)\s+categorie\b/.exec(suite)?.[1];
    let part = null;
    let sorte = null;
    if (/\ba repartir\b/.test(destination)) [part, sorte] = [choix(points, toutes, limite === undefined ? null : Number(limite)), 'repartir'];
    else if (/^(?:d'\s*armes?|armes?)?$/.test(destination)) [part, sorte] = [choix(points, toutes), 'sans_destination'];
    else if (/\bdeterminee avant\b|\bautre arme choisie\b/.test(destination)) [part, sorte] = [suit(points), 'suit'];
    else if (categorieEcrite(destination)) [part, sorte] = [choix(points, parCategorie(familles, categorieEcrite(destination))), 'categorie'];
    else {
      const nom = destination.replace(/^(?:avec|a|au|aux|de|du|des|en)\s+/, '').replace(/^(?:l'\s*|la\s+|le\s+|les\s+)/, '').replace(/^d'\s*/, '');
      const famille = familleNommee(nom, familles);
      if (famille) [part, sorte] = [imposee(points, famille), 'nommee'];
    }
    if (part && (part.genre !== 'choix' || points > 0)) {
      parts.push(part);
      sortes.push(sorte);
    } else nonLues.push(ecrit);
  });
  const cle = [...new Set(sortes)].join('+');
  const forme = !parts.length ? null : (FORMES_DES_DONS.get(cle)?.(parts) ?? 'mixte');
  return avecNonLues({ forme, parts: rangees(parts) }, nonLues);
}
