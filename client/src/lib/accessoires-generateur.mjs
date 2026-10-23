// Générateur d'accessoires de l'onglet Accessoires de /ressources/equipement/ (demande du propriétaire, 2026-10-14 : « au lieu d'un tableau Markdown,
// un générateur d'accessoire ») : fonctions pures, sans dépendance, partagées par le gabarit (components/accessoires/AccessoiresPage.astro) et le
// script de la page (src/scripts/accessoires.mjs, le seul script de page qui importe ce module). Aucune règle n'est déduite : les dés sont ceux des
// tables de l'onglet (le plus grand jet écrit d'une table donne ses faces : 1d4, 1d100, 1d6, 1d20), la qualité de gemme d'un niveau est la phrase des
// règles de la page. Les couleurs des niveaux ne sont pas ici : lib/accessoires-couleurs.mjs (la règle), lib/palette-css.mjs (leur classe,
// `couleur-niveau-<n>`, que le gabarit pose et que le script reprend de la ligne choisie).

/**
 * Qualité de gemme d'un niveau d'accessoire, d'après les règles de la page : « Gemme classique = Accessoire niveau 1 et 2 », « Gemme raffinée =
 * Accessoire niveau 3 et 4 », « Gemme parfaite = Accessoire niveau 5 ». Clés = colonnes de la table `gemme` (`quart_commune_rf`…).
 */
export const QUALITES_DE_GEMME = [
  { id: 'commune', libelle: 'classique', niveaux: [1, 2] },
  { id: 'raffinee', libelle: 'raffinée', niveaux: [3, 4] },
  { id: 'parfaite', libelle: 'parfaite', niveaux: [5] },
];

/** La qualité de gemme d'un niveau ({ id, libelle, niveaux }), ou null (niveau inconnu). */
export const qualiteDeGemme = (niveau) => QUALITES_DE_GEMME.find((q) => q.niveaux.includes(Number(niveau))) ?? null;

/** Faces du dé d'une table : son plus grand jet écrit (« 1d4 » pour les jets 1 à 4, « 1d100 » pour les plages jusqu'à 100). */
export const facesDuDe = (jets) => Math.max(0, ...jets.map(Number).filter(Number.isFinite));

/** Un jet de 1 à `faces` ; `alea` rend un nombre dans [0, 1[ (Math.random par défaut, remplaçable pour les tests). */
export const lancer = (faces, alea = Math.random) => 1 + Math.min(faces - 1, Math.floor(alea() * faces));

/** L'élément dont la plage [min, max] contient `jet` (propriétés : 1-5, 6-20…), ou null. */
export const dansLaPlage = (plages, jet) => plages.find((p) => Number(p.min) <= jet && jet <= Number(p.max)) ?? null;

/**
 * Bonus d'acquis de la propriété Compétence (demande du propriétaire, 2026-10-16 : « La valeur de "Bonus d’acquis" deviendrai un slider (qui peut être
 * varié par un dé, ou saisi manuellement) En fonction de la valeur, ça changer automatiquement le niveau, donc la couleur et donc le prix. ») : un entier
 * de `min` à `max`, les bornes des plages écrites (1 % à 20 %) ; une saisie qui n'est pas un nombre donne `min`. Le niveau est celui dont la plage écrite
 * contient le bonus (`dansLaPlage`) : rien n'est calculé au-delà.
 */
export function bonusBorne(valeur, min, max) {
  const n = Math.round(Number(String(valeur ?? '').replace(',', '.')));
  return Number.isFinite(n) && String(valeur ?? '').trim() !== '' ? Math.min(max, Math.max(min, n)) : min;
}

/**
 * Une ligne du tableau des compétences et son bonus d'acquis : `niveaux` = ses effets, un par niveau ({ valeur, niveau, min, max… }, plages écrites
 * du 1d20). Rend { bonus, effet } : le bonus borné aux plages de la ligne et l'effet dont la plage le contient (le premier si les plages laissaient un
 * trou) ; null pour une ligne sans effet.
 */
export function effetDuBonus(niveaux, valeur) {
  if (!niveaux?.length) return null;
  const bonus = bonusBorne(valeur, Math.min(...niveaux.map((n) => Number(n.min))), Math.max(...niveaux.map((n) => Number(n.max))));
  return { bonus, effet: dansLaPlage(niveaux, bonus) ?? niveaux[0] };
}

/**
 * Le bonus d'acquis d'une ligne des compétences d'après l'adresse (?effet=<clé d'un de ses effets>&acquis=<bonus>) : `acquis` s'il est un entier de la
 * plage de cet effet, sinon le plus petit bonus de cette plage (l'effet de l'adresse fait foi) ; null si la clé n'est pas un effet de la ligne.
 */
export function bonusDeLAdresse(niveaux, cle, acquis) {
  const n = (niveaux ?? []).find((x) => x.valeur === cle);
  if (!n) return null;
  const a = acquis === null || acquis === undefined || String(acquis).trim() === '' ? Number.NaN : Number(acquis);
  return Number.isInteger(a) && a >= Number(n.min) && a <= Number(n.max) ? a : Number(n.min);
}

/**
 * L'ancre gardée dans l'adresse : celle d'un onglet d'effets (#effets-…) ne l'est pas, la propriété de l'adresse dit l'onglet ouvert ; elle laisse sa
 * place à `ancreDuPanneau`, l'ancre de l'onglet de la page qui contient le générateur (« #accessoires » : l'onglet Accessoires de la page
 * « Équipement », qu'une adresse sans ancre n'ouvrirait pas).
 */
export const ancreGardee = (ancre, ancreDuPanneau = '') => (String(ancre ?? '').startsWith('#effets-') ? String(ancreDuPanneau ?? '') : String(ancre ?? ''));

/**
 * Malédiction (décision R94, demande du propriétaire du 2026-10-16 : « Si à n'importe quel étape "Malédiction" est choisi, on relance tout l'item à
 * partir de l'étape 2 (on garde le même emplacement) Dans le 2em roll si on retombe à nouveau sur "Malédiction", l'objet est DETRUIT et tombe en
 * poussière. ») : un jet qui tombe sur une malédiction (propriété « Malédiction » de l'étape 2, ligne « MALÉDICTION » d'un tableau d'effets de
 * l'étape 3) rend l'accessoire maudit ; s'il l'était déjà, il est détruit.
 */
export const apresUneMalediction = ({ maudit = false, detruit = false } = {}) => ({ maudit: true, detruit: Boolean(maudit || detruit) });

/**
 * Les drapeaux { maudit, detruit } après un jet de dé de l'étape `etape` (1, 2 ou 3) qui a tiré une ligne (`malediction` : c'en est une), R94. Avant
 * la transition, le jet commence un **nouvel accessoire** (ni maudit ni détruit) quand il relance l'étape 1 (R94 garde l'emplacement dans la relance :
 * relancer l'emplacement, c'est un autre accessoire) ou quand l'accessoire est détruit (« sans troisième tirage » : il ne revient pas) ; sinon les
 * drapeaux restent. Puis une malédiction tirée passe par `apresUneMalediction` ; une autre ligne n'y change rien.
 * Commun aux deux chemins : « Tirer un accessoire » (`tirerUnAccessoire`) et le dé d'un tableau (src/scripts/accessoires.mjs) passent chaque jet par
 * cette fonction. Pas commun : « Tirer un accessoire » repart de zéro, ne tire l'étape 1 qu'une fois, ne garde rien d'une manche à l'autre et s'arrête
 * à la destruction ; un dé de tableau garde ce qu'il ne relance pas (emplacement, effet qui n'est pas une malédiction, monture, gemmes), et celui de
 * l'étape 2 retire un effet « MALÉDICTION » déjà choisi (relancer l'étape 2, c'est refaire les étapes 2 et 3 : le script). Un clic n'est pas un jet :
 * il ne passe pas ici (une ligne de malédiction cliquée rend maudit, jamais détruit ; le script).
 */
export function apresUnJet({ maudit = false, detruit = false } = {}, { etape, malediction = false } = {}) {
  const avant = etape === 1 || detruit ? { maudit: false, detruit: false } : { maudit: Boolean(maudit), detruit: false };
  return malediction ? apresUneMalediction(avant) : avant;
}

/**
 * Un accessoire tiré entier (« Tirer un accessoire », R94). `emplacement()`, `propriete()` et `effet(propriete)` tirent chacun leur table (étapes 1, 2
 * et 3 ; injectés, pour les tests) et rendent la ligne tirée, `{ malediction: booléen, … }`, ou null. L'étape 1 est tirée une seule fois : une
 * malédiction à l'étape 2 (l'étape 3 n'est alors pas tirée) ou à l'étape 3 rend l'accessoire maudit et fait relancer les étapes 2 et 3, même
 * emplacement ; une malédiction dans cette relance le détruit, sans troisième tirage (chaque jet passe par `apresUnJet` : au plus deux tours). Une étape
 * qui ne rend aucune ligne (les tables sont complètes : test/accessoires-db.test.mjs) arrête le tirage là, sans boucler.
 * Rend { emplacement, propriete, effet, maudit, detruit } : les lignes du dernier tour (`effet` null quand la propriété est la malédiction).
 */
export function tirerUnAccessoire({ emplacement, propriete, effet }) {
  const e = emplacement() ?? null;
  let etat = apresUnJet({}, { etape: 1, malediction: Boolean(e?.malediction) });
  const resultat = (p = null, x = null) => ({ emplacement: e, propriete: p, effet: x, ...etat });
  if (!e) return resultat();
  for (;;) {
    const p = propriete() ?? null;
    if (!p) return resultat();
    etat = apresUnJet(etat, { etape: 2, malediction: p.malediction });
    if (etat.detruit) return resultat(p);
    if (p.malediction) continue;
    const x = effet(p) ?? null;
    if (!x) return resultat(p);
    etat = apresUnJet(etat, { etape: 3, malediction: x.malediction });
    if (etat.detruit || !x.malediction) return resultat(p, x);
  }
}

/**
 * L'état de malédiction qui tient (R94) : « détruit » ne tient que tant que la propriété ou l'effet choisi est une malédiction (`malediction`), et il
 * implique « maudit ». Sert à l'adresse (?maudit=1&detruit=1, lue telle quelle, jamais par la transition) et après chaque choix.
 */
export function etatDeMalediction({ maudit = false, detruit = false, malediction = false } = {}) {
  const d = Boolean(detruit && malediction);
  return { maudit: Boolean(maudit || d), detruit: d };
}

/**
 * La note de l'encart sur la malédiction (R94), ou null : détruit ; une ligne de malédiction choisie (relancer depuis l'étape 2) ; maudit (l'effet est le
 * contraire, R54). Rien n'est inversé ni calculé : la note le dit.
 */
export function noteDeMalediction({ maudit = false, detruit = false, malediction = false } = {}) {
  if (detruit) return 'Seconde malédiction : l’accessoire est détruit et tombe en poussière.';
  if (malediction) {
    return 'Malédiction : relancez les dés depuis l’étape 2, avec le même emplacement ; l’accessoire sera maudit (l’effet obtenu sera le contraire de ce qui est indiqué). Une seconde malédiction le détruit : il tombe en poussière.';
  }
  if (maudit) return 'Accessoire maudit : l’effet est le contraire de ce qui est indiqué (exemple : +1 force devient -1 force).';
  return null;
}

/**
 * Paramètres de l'adresse de la page : ?emplacement=<id>&propriete=<id>&effet=<fin de l'id de l'effet>&acquis=<jet>&monture=<niveau>&gemmes=<clé>,<clé>&maudit=1&detruit=1.
 * `lireEtat` ne garde que des chaînes non vides ; `ecrireEtat` les remet dans le même ordre (les vides sont retirés).
 */
export const PARAMETRES = ['emplacement', 'propriete', 'effet', 'acquis', 'monture', 'gemmes', 'maudit', 'detruit'];

export function lireEtat(recherche) {
  const p = new URLSearchParams(recherche);
  return Object.fromEntries(PARAMETRES.map((k) => [k, p.get(k) || null]).filter(([, v]) => v !== null));
}

export function ecrireEtat(recherche, etat) {
  const p = new URLSearchParams(recherche);
  for (const k of PARAMETRES) p.delete(k);
  for (const k of PARAMETRES) if (etat[k] !== undefined && etat[k] !== null && etat[k] !== '' && etat[k] !== false) p.set(k, String(etat[k] === true ? 1 : etat[k]));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Partie d'un identifiant d'effet après « #effet: » (« attaque:5 », « competence:force:2 ») : ce qui va dans l'adresse et dans `data-effet`. */
export const cleDEffet = (id) => String(id).slice(String(id).indexOf('#effet:') + 7);

/**
 * Gemmes au choix (demande du propriétaire, 2026-10-14 : « Dans le cas où les gemmes sont au choix, laisser la possibilité d'en cocher 2 ») : un effet écrit
 * ses gemmes en rangs (« A + B ») dont certains laissent le choix (« Turquoise ou + Perle ou + Diamant rose ou + Onyx », « Onyx + Grenat/Malachite »).
 * Un rang à une seule gemme est imposé ; les autres sont au choix, deux gemmes en tout (`GEMMES_PAR_ACCESSOIRE`) : « Onyx + Grenat/Malachite » laisse
 * en cocher une, les quatre gemmes de l'Intelligence en laissent cocher deux. `rangs` : listes de clés de gemme (« onix »).
 * { imposees: [clé], auChoix: [clé], max } ; `max` = 0 quand rien n'est au choix.
 */
const GEMMES_PAR_ACCESSOIRE = 2;

export function gemmesAuChoix(rangs) {
  const imposees = rangs.filter((r) => r.length === 1).map((r) => r[0]);
  const auChoix = [...new Set(rangs.filter((r) => r.length > 1).flat())].filter((g) => !imposees.includes(g));
  return { imposees, auChoix, max: auChoix.length ? Math.max(0, GEMMES_PAR_ACCESSOIRE - imposees.length) : 0 };
}

/** Les gemmes cochées qui valent pour ces rangs : parmi celles au choix, sans doublon, `max` au plus (les premières cochées). */
export function gemmesCochees(rangs, cochees) {
  const { auChoix, max } = gemmesAuChoix(rangs);
  return [...new Set(cochees)].filter((g) => auChoix.includes(g)).slice(0, max);
}

/**
 * Prix d'un accessoire aux gemmes au choix (demande du propriétaire : cocher les gemmes « mettra alors le prix à jour »), sur la composition que suivent
 * les prix écrits du tableau (test/accessoires-db.test.mjs le vérifie sur chaque effet à gemmes imposées) : le quart de chaque gemme, à la qualité du
 * niveau de l'effet, plus la monture. `quartsRf` : le prix d'un quart de chaque gemme retenue, en RF (1 RO = 100 RF) ; `montureRo` : en RO.
 * Rend le prix en RO, ou null s'il manque une valeur.
 */
export function prixDeLAccessoire(quartsRf, montureRo) {
  if (!quartsRf.length || quartsRf.some((q) => !Number.isFinite(q)) || !Number.isFinite(montureRo)) return null;
  return quartsRf.reduce((s, q) => s + q, 0) / 100 + montureRo;
}
