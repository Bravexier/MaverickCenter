// Découpage d'une carte de monstre du « Bestiaire 2.0 » : ce que la base tire du texte de ses rubriques (data/schema.sql, section 8 bis). Le même découpage
// sert à l'extraction du doc (tools/bestiaire/extraire.mjs), à la page (lib/bestiaire-db.mjs, rendu de la carte) et au mode modification du site de dev
// (serveur/edition.mjs : une rubrique modifiée refait les valeurs typées de la carte) ; les capacités, elles, sont des tables à part (décision R66 :
// emplacements « {N} » des descriptions, `emplacements`, `avecLesValeurs`). Rien n'est déduit : une valeur n'est typée que si son écriture est
// sans ambiguïté (sinon NULL, le texte de la rubrique fait foi). Fonctions pures ; seule dépendance : lib/text.mjs.
import { normalize } from './text.mjs';

/** Rubriques qui listent des cibles (« Brûlure, Paralysie ») : sens d'une ligne de `monstre_defense`, dans l'ordre. */
export const SENS_DEFENSE = ['vulnerabilite', 'grande_vulnerabilite', 'resistance', 'grande_resistance', 'double_resistance', 'immunite', 'reflexion'];

/** Toutes les rubriques d'une carte (colonne `monstre_rubrique.rubrique`), dans l'ordre où le doc les écrit d'habitude, avec leur titre par défaut. */
export const RUBRIQUES = {
  attributs: 'Santé, chakra, barrière',
  sante: 'Santé',
  chakra: 'Chakra',
  barriere: 'Barrière',
  degats: 'Dégâts',
  defense: 'Défense',
  vitesse: 'Vitesse',
  caracteristiques: 'Caractéristiques (F.P.V.S.I.A.)',
  competences: 'Compétence(s) secondaire(s)',
  vulnerabilite: 'Vulnérabilité(s) Dégâts x2',
  grande_vulnerabilite: 'Grande(s) Vulnérabilité(s) Dégâts x4',
  resistance: 'Résistance(s) Dégâts ÷2',
  grande_resistance: 'Grande(s) Résistance(s) Dégâts ÷4',
  double_resistance: 'Double(s) Résistance(s) Dégâts/Effets ÷4',
  immunite: 'Immunité(s) Dégâts/Effets = 0',
  reflexion: 'Réflexion(s) Renvoi des dégâts/effets',
  capacites: 'Capacité(s)',
  tactique: 'TACTIQUE COMBAT',
};

/**
 * Rubriques d'une carte créée depuis le site de dev (serveur/edition-bestiaire.mjs), vides, avec leur titre par défaut : la disposition de la plupart
 * des cartes du doc (181 cartes sur 315 : santé, chakra et barrière sur une ligne, dégâts, défense, vitesse, caractéristiques, compétences,
 * vulnérabilités, résistances, immunités, capacités, tactique).
 */
export const GABARIT_DE_CARTE = ['attributs', 'degats', 'defense', 'vitesse', 'caracteristiques', 'competences', 'vulnerabilite', 'resistance', 'immunite', 'capacites', 'tactique'];

/** Lieux de rencontre d'une espèce (`monstre_espece_lieu`) : la ligne « Lieu de rencontre » découpée aux virgules, chaque lieu tel qu'écrit. */
export const lieux = (texte) =>
  String(texte ?? '')
    .split(/\s*,\s*/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((lieu, k) => ({ rang: k + 1, lieu, lieu_cle: normalize(lieu) }));

/** Catégories d'un monstre : clé de `monstre.categorie` -> libellé ; et lecture de l'écriture du doc (« Mini boss », « Mini-Boss » -> 'mini_boss'). */
export const CATEGORIES = { ennemi_simple: 'Ennemi simple', mini_boss: 'Mini-boss', boss: 'Boss' };
const CLES_CATEGORIES = { 'ennemi-simple': 'ennemi_simple', 'mini-boss': 'mini_boss', boss: 'boss' };
export const categorieDe = (brut) => CLES_CATEGORIES[normalize(brut ?? '')] ?? null;

/** Les six caractéristiques, dans l'ordre F.P.V.S.I.A. (même ordre que creature_caracteristique). */
export const FPVSIA = ['force', 'perception', 'volonte', 'social', 'intelligence', 'agilite'];

const paragraphes = (texte) => (texte ? texte.split(/\n\n+/) : []);
const entiers = (texte) => [...String(texte ?? '').matchAll(/\d+/g)].map((m) => Number(m[0]));

/** Échelles couvertes par une écriture (« 2 », « 1-10 », « EP3, 5, 7 ») : [min, max], ou [null, null] sans nombre. */
export function bornes(texte) {
  const n = entiers(texte);
  return n.length ? [Math.min(...n), Math.max(...n)] : [null, null];
}

/**
 * Les échelles qu'écrit une carte ou une espèce (`monstre.echelle_brut`, `monstre_espece.ep_brut` : « 2 », « 1-10 », « 2-6 », « 3,5,7 », « 3, 5, 7 »,
 * « EP1 - 10 », « EP3, 5, 7 ») : la liste croissante, sans doublon. Une plage « a-b » donne toutes ses échelles, une liste seulement celles qu'elle nomme
 * (« 3, 5, 7 » : ni 4 ni 6) ; une écriture sans nombre, aucune. Le curseur d'échelle de la carte et le filtre EP du tableau la suivent (bornes() garde le
 * plus petit et le plus grand nombre : `ep_min`, `ep_max`, le tri).
 */
export function echellesEcrites(texte) {
  const eps = String(texte ?? '')
    .replace(/^\s*EP\s*/i, '')
    .split(/\s*,\s*/)
    .flatMap((p) => {
      const plage = p.trim().match(/^(\d+)\s*-\s*(\d+)$/);
      if (plage) {
        const [a, b] = [Number(plage[1]), Number(plage[2])];
        return a <= b ? Array.from({ length: b - a + 1 }, (_, k) => a + k) : [];
      }
      return /^\d+$/.test(p.trim()) ? [Number(p.trim())] : [];
    });
  return [...new Set(eps)].sort((x, y) => x - y);
}

// Une ligne d'une rubrique écrite par échelle (carte qui « varie selon son échelle de puissance ») : « EP 2 - 5 : … », « EP3 : … », « [EP3] … »,
// « [EP3,5,7] … », avec une forme devant (« (Guerrier) EP 1 - 10 : 10 », « (Neige) [EP3] … ») ; la ligne à deux colonnes du doc (« EP 1 : 20 EP 6 : 140 »).
const LIGNE_PAR_ECHELLE = /^(\([^)\n]+\)\s*)?(?:\[EP\s*(\d[\d,\s-]*)\]\s*|EP\s*(\d[\d,\s-]*?)\s*:\s*)(.*)$/;
const DEUX_COLONNES = /^EP\s*\d+\s*:\s*\d[\d ]*\s+EP\s*\d+\s*:\s*\d[\d ]*$/;
// un titre de groupe seul sur sa ligne (« Neige », « Cristal », « Âme », « Sang ») : un mot, sa majuscule
const TITRE_DE_GROUPE = /^\p{Lu}[\p{Ll}’']+$/u;

/**
 * Le texte d'une rubrique découpé ligne à ligne pour le curseur d'échelle de la carte (lib/monstre-rendu.mjs) : chaque ligne écrite pour une ou plusieurs
 * échelles est un segment { eps, forme, etiquette, valeur, texte } (`etiquette` : « EP 2 - 5 » tel qu'écrit, `valeur` : la suite de la ligne) ; la ligne à
 * deux colonnes donne deux segments ; un titre de groupe (« Neige ») donne { titre } ; une ligne vide { vide: true } ; toute autre ligne { texte } (elle
 * reste affichée à toutes les échelles). Rien n'est calculé : chaque valeur est celle que la carte écrit pour cette échelle. Le texte des segments redonne
 * celui de la rubrique (aux espaces de la ligne à deux colonnes près).
 */
export function segmentsParEchelle(texte) {
  const sortie = [];
  for (const ligne of String(texte ?? '').split('\n')) {
    const l = ligne.trim();
    if (!l) {
      sortie.push({ vide: true });
      continue;
    }
    if (DEUX_COLONNES.test(l)) {
      for (const m of l.matchAll(/EP\s*(\d+)\s*:\s*(\d[\d ]*?)(?=\s+EP|\s*$)/g)) {
        sortie.push({ eps: [Number(m[1])], forme: null, etiquette: `EP ${m[1]}`, valeur: m[2].trim(), texte: m[0].trim() });
      }
      continue;
    }
    const m = l.match(LIGNE_PAR_ECHELLE);
    const eps = m ? echellesEcrites(m[2] ?? m[3]) : [];
    if (m && eps.length) {
      const etiquette = m[2] !== undefined ? `EP ${m[2].trim()}` : `EP ${m[3].trim()}`;
      sortie.push({ eps, forme: m[1]?.trim() ?? null, etiquette, valeur: m[4].trim(), texte: l });
      continue;
    }
    if (TITRE_DE_GROUPE.test(l)) sortie.push({ titre: l });
    else sortie.push({ texte: l });
  }
  return sortie;
}

/** Le renvoi d'une carte au tableau de l'introduction (« Se fier au dégâts moyen dans le tableau de l'introduction. », rubrique « degats ») : seule une
 *  carte qui l'écrit montre, à côté de son curseur d'échelle, les phrases « Dégâts moyens » du tableau (lib/monstre-rendu.mjs#htmlDeLEchelle). */
export const RENVOI_AUX_DEGATS_MOYENS = /Se fier aux? dégâts? moyens? dans le tableau de l[’']introduction/i;
/** `rubriques` : [{ rubrique, texte }] d'une carte. */
export const renvoieAuxDegatsMoyens = (rubriques) => (rubriques ?? []).some((r) => r.rubrique === 'degats' && RENVOI_AUX_DEGATS_MOYENS.test(r.texte ?? ''));

/** Une rubrique écrite par échelle : au moins une ligne de segmentsParEchelle porte des échelles. */
export const parEchelle = (texte) => segmentsParEchelle(texte).some((s) => s.eps);

/**
 * Une valeur qui progresse avec l'échelle, « N (+k/mEP) » ou « N (+k/EP) » (m = 1) : N à l'EP 1, puis +k toutes les m échelles, sans compter l'EP 1,
 * quelle que soit la première échelle de la carte. Décision R55 (« +2 tous les 3 EP. 5 (+2/3EP) veux dire 7 à 4, 9 à 7 et 11 à 10 ») et R59, le calcul
 * donné par le propriétaire (« 2 + 1/EP » : 2 à l'EP 1, 3 à l'EP 2… 11 à l'EP 10 ; « on ne compte pas le EP1 dans le calcul "par EP" ») : le Collecteur
 * (EP 2 à 6), « 2 (+1/EP) », vaut 3 à l'EP 2. Le nombre est celui qui précède la formule, des mots pouvant les séparer (« 5 armure physique (+2/3EP) »,
 * « 5 (+2/3EP) armure magique »).
 */
const PROGRESSION = /(\d+)((?:[ \t]+\p{L}+)*?)[ \t]*\([ \t]*\+[ \t]*(\d+)[ \t]*\/[ \t]*([1-9]\d*)?[ \t]*EP[ \t]*\)/gu;
/** Les formules d'un texte : [{ index, longueur, base, mots, pas, tous }] (`tous` : m ≥ 1, 1 pour « /EP » ; « /0EP » n'est pas une formule). */
export const progressions = (texte) =>
  [...String(texte ?? '').matchAll(PROGRESSION)].map((m) => ({ index: m.index, longueur: m[0].length, base: Number(m[1]), mots: m[2], pas: Number(m[3]), tous: m[4] ? Number(m[4]) : 1 }));
/** La valeur d'une formule à l'échelle `ep` : N + k × ⌊(EP − 1) / m⌋ (décisions R55, R59). */
export const valeurALEchelle = ({ base, pas, tous }, ep) => base + pas * Math.floor((ep - 1) / tous);
/**
 * Un texte à formules lu à chaque échelle écrite de la carte (`echelles`, croissantes) : [{ eps, morceaux }] où les échelles consécutives qui donnent le même
 * texte sont regroupées ; un morceau est { texte } (écrit tel quel) ou { valeur, formule } (la valeur calculée et la formule écrite). [] sans formule ou sans
 * échelle écrite (une carte d'une seule échelle a sa valeur, la formule ne dépendant que de l'EP).
 */
export function texteParEchelle(texte, echelles = []) {
  const t = String(texte ?? '');
  const f = progressions(t);
  if (!f.length || !echelles.length) return [];
  const groupes = [];
  for (const ep of echelles) {
    const morceaux = [];
    let i = 0;
    for (const x of f) {
      if (x.index > i) morceaux.push({ texte: t.slice(i, x.index) });
      morceaux.push({ valeur: valeurALEchelle(x, ep), formule: t.slice(x.index, x.index + x.longueur), mots: x.mots });
      i = x.index + x.longueur;
    }
    if (i < t.length) morceaux.push({ texte: t.slice(i) });
    const cle = JSON.stringify(morceaux.map((m) => m.texte ?? `${m.valeur}${m.mots}`));
    const dernier = groupes.at(-1);
    if (dernier && dernier.cle === cle && echelles[echelles.indexOf(dernier.eps.at(-1)) + 1] === ep) dernier.eps.push(ep);
    else groupes.push({ cle, eps: [ep], morceaux });
  }
  return groupes.map(({ eps, morceaux }) => ({ eps, morceaux }));
}

/**
 * Un trait « ________________ » (ligne de séparation du doc) dans le texte d'une rubrique : ce qui le suit n'a pas de place décidée. À l'import, un
 * seul cas : « Ottar (explication) », section de lore écrite à la suite de la carte dans le Bestiaire 2.0, que l'extraction a rattachée à la tactique de
 * l'Os du blizzard. Demande du propriétaire : « Je ne sais pas. Signale le avec un panneau "attention" » (lib/monstre-rendu.mjs#htmlDAttention). Ce texte
 * est depuis la description de l'espèce « Ottar » (décision R64, `monstre_groupe`) ; le propriétaire l'a coupé de la tactique sur le site de dev.
 * { avant, apres } coupé au premier trait, sans les lignes vides qui l'entourent ; null sans trait ou sans rien après.
 */
const TRAIT = /^[ \t]*_{3,}[ \t]*$/m;
export function apresUnTrait(texte) {
  const t = String(texte ?? '');
  const m = TRAIT.exec(t);
  if (!m) return null;
  const apres = t.slice(m.index + m[0].length).replace(/^\s*\n/, '').trimEnd();
  return apres.trim() ? { avant: t.slice(0, m.index).trimEnd(), apres } : null;
}

/** Le préfixe d'une capacité « [EPN] » (décision R56 : la capacité est gagnée à partir de l'EP N) : N, ou null. */
export const echelleDuPrefixe = (prefixe) => {
  const m = String(prefixe ?? '').match(/\[EP\s*(\d+)\]/);
  return m ? Number(m[1]) : null;
};

/**
 * Emplacements de la description d'une capacité commune (décision R69 : « si l'effet ne diffère que d'un chiffre, le mettre modifiable par un
 * slider ») : chaque « {N} », N entier, est un emplacement dont la valeur commune est N. Renvoie ces valeurs communes, dans l'ordre (le 1er emplacement
 * d'abord : c'est son numéro dans monstre_capacite_valeur).
 */
export const emplacements = (description) => [...String(description ?? '').matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));

/**
 * Les emplacements d'une description, pour le curseur du site de dev (décision R69) : [{ numero, commune, pourcent }], dans l'ordre d'`emplacements` ;
 * `pourcent` : un « % » suit l'accolade (« {10}% », ou « {10} % » avec une espace, insécable ou non).
 */
export function emplacementsDetailles(description) {
  const pourcents = [...String(description ?? '').matchAll(/\{\d+\}(\s?%)?/g)].map((m) => Boolean(m[1]));
  return emplacements(description).map((commune, i) => ({ numero: i + 1, commune, pourcent: pourcents[i] ?? false }));
}

/**
 * La borne haute du curseur d'un emplacement (arbitrage, décision R69) : 100 pour un pourcentage, sinon au moins 20 et deux fois la plus grande des
 * valeurs commune et propre à la carte ; la saisie au clavier va au-delà.
 */
export const borneDuCurseur = (emplacement, propre = null) => (emplacement.pourcent ? 100 : Math.max(20, 2 * Math.max(emplacement.commune, propre ?? 0)));

/**
 * Ce qu'une carte envoie pour les valeurs de ses emplacements (opération valeurs_de_capacite, décision R69) : `choisies` (numéro -> valeur réglée au
 * curseur), `propres` (numéro -> valeur propre lue au service) ; la valeur commune s'envoie null (la carte suit alors la description), et seule une valeur
 * qui change quelque chose part ; un numéro absent de la description (emplacement retiré entre-temps) est laissé. -> { numéro: valeur ou null }.
 */
export function valeursAEnvoyer(description, choisies, propres) {
  const places = emplacementsDetailles(description);
  const sortie = {};
  for (const [numero, v] of choisies) {
    const p = places[Number(numero) - 1];
    if (!p) continue;
    const voulue = v === p.commune ? null : v;
    if (voulue !== (propres.get(Number(numero)) ?? null)) sortie[numero] = voulue;
  }
  return sortie;
}

/**
 * La description d'une capacité commune telle qu'une carte l'affiche : chaque « {N} » remplacé par la valeur de la carte pour cet emplacement
 * (`valeurs` : numéro de l'emplacement -> valeur, monstre_capacite_valeur), sinon par sa valeur commune N.
 */
export function avecLesValeurs(description, valeurs = {}) {
  let k = 0;
  return String(description ?? '').replace(/\{(\d+)\}/g, (_, n) => String(valeurs[++k] ?? Number(n)));
}

/**
 * « Pince - 2d10 + 2 dégâts d’estoc », « Bâton mal-foutue: 1d6 dégâts de frappe » -> { rang, nom, texte } ; une ligne sans « nom - texte » chiffré n'est pas
 * une attaque (« Arme de la créature : », « Se fier au dégâts moyen… », « EP 1 - 10 : Faux déformée… » d'une carte qui varie selon l'échelle).
 */
export function attaques(texte) {
  return String(texte ?? '')
    .split('\n')
    .map((l) => l.match(/^(.{1,60}?)(?:\s+[-–]\s+|\s*:\s+)(.*\d.*)$/))
    .filter((m) => m && !/^(\[?EP\s*\d|Arme de la créature)/i.test(m[1]))
    .map((m, k) => ({ rang: k + 1, nom: m[1].trim(), texte: m[2].trim() }));
}

/**
 * Capacités : un paragraphe « [EP2] Nom. Texte » ouvre une capacité ; un paragraphe qui ne commence pas par un nom (tableau, suite) continue la précédente.
 * Préfixe : les crochets et parenthèses avant le nom, tels qu'écrits (« [EP2] », « [Gauche] » d'une tête du Cerbère, « (Neige) [EP3] » d'une forme) ;
 * ep_min : le N du premier « [EPN] » du préfixe (capacité gagnée à partir de cette échelle), sinon NULL. Un premier paragraphe sans nom n'en a pas (nom NULL).
 */
export function capacites(texte) {
  const sortie = [];
  for (const p of paragraphes(texte)) {
    const m = p.match(/^((?:[[(][^\])\n]*[\])]\s*)*)([^.:\n]{1,70}?)\s*\.\s+([\s\S]*)$/);
    if (m && /^[\p{Lu}\d]/u.test(m[2])) {
      const prefixe = m[1].trim() || null;
      const ep = prefixe?.match(/\[EP\s*(\d+)/);
      sortie.push({ rang: sortie.length + 1, prefixe, ep_min: ep ? Number(ep[1]) : null, nom: m[2].trim(), texte: m[3].trim() });
    } else if (sortie.length) sortie.at(-1).texte += `\n\n${p}`;
    else sortie.push({ rang: 1, prefixe: null, ep_min: null, nom: null, texte: p });
  }
  return sortie;
}

/**
 * L'objet du glossaire du butin (`monstre_butin_objet`) qu'une case de butin cite (demande du propriétaire : le contenu du glossaire « pour faire un
 * tooltip […] sur le butin concerné ») : son nom écrit tel quel (casse, accents, espaces et apostrophe compris ; seule la ligature compte pour ses deux
 * lettres : « Coeur polaire » cite « Cœur polaire ») en tête de la case, suivi de rien, d'une quantité (« x 1d6 », « x1 », « (1d4) ») ou d'une
 * amélioration (« + 1 », « +2 ») ; le nom le plus long l'emporte (« Gelée verte foncée » avant « Gelée verte »).
 * Décision R57 (« Corrige et rapproche les. Les fautes de frappe ça arrive. ») : les fautes de frappe sont corrigées dans la base (extracteur,
 * CORRECTIONS) et un objet se cite aussi avec son élément, une magie (`elements`) : les objets qui valent pour tous les éléments (FAMILLES_PAR_ELEMENT :
 * « Minitaire de Foudre », « Fragment de pièce de Feu ») et un fruit avec l'élément que nomme sa définition (« Fraise : Fruit du Feu » -> « Fraise de
 * feu ») : l'infobulle montre l'entrée « Fraise » du glossaire, sous son nom (« A l'instar des matériaux et des gemmes chaque fruit est de base lié à
 * un élément. "Fraise de feu" et "fraise" reportent au même », R57).
 * `glossaire` : [{ id, nom, texte }] ; -> { objet, ecrit, reste } (`ecrit` : l'objet tel que la case l'écrit) ou null.
 */
const SUFFIXE_DU_BUTIN = /^(?:| x ?\d+(?:d\d+)?| \(\d+d\d+\)| ?\+ ?\d+)$/;
const sansLigature = (texte) => texte.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe');
/**
 * Les objets du glossaire qui valent pour tous les éléments, et l'écriture que le butin leur donne devant l'élément (décision R57) : le Minitaire
 * (« Version miniature d’un élémentaire » : « Minitaire de Foudre », « Minitaire d’Eau ») et le fragment de pièce élémentaire (« Morceau d’une pièce
 * élémentaire brisée » : « Fragment de pièce de Feu », « Fragment de pièce de la Glace », « Fragment de pièce Espace/Temps »).
 */
export const FAMILLES_PAR_ELEMENT = { minitaire: 'Minitaire', 'fragment-de-piece-elementaire': 'Fragment de pièce' };
/** L'élément qu'une définition de fruit nomme (« Fruit du Feu, ingrédient… » -> « Feu »), s'il est une magie de `elements` ; sinon null. */
export function elementDuFruit(definition, elements = []) {
  const m = String(definition ?? '').match(/^Fruit (?:de la |de l’|de l'|du |d’|d'|de )([^,.;]+?)\s*[,.;]/);
  return m ? (elements.find((el) => el.toLowerCase() === m[1].toLowerCase()) ?? null) : null;
}
// « de », « du », « d’ », « de la », « de l’ » devant l'élément, ou rien (« Fragment de pièce Espace/Temps »)
const LIAISONS = ['de la ', 'de l’', "de l'", 'du ', 'd’', "d'", 'de ', ''];
/** Longueur de « <base> <liaison><élément> » en tête de `t` (l'élément en n'importe quelle casse), 0 sinon. */
function avecElement(t, base, elements) {
  if (!t.startsWith(`${base} `)) return 0;
  const reste = t.slice(base.length + 1);
  for (const l of LIAISONS) {
    if (!reste.startsWith(l)) continue;
    const apres = reste.slice(l.length);
    const el = [...elements].sort((a, b) => b.length - a.length).find((x) => apres.slice(0, x.length).toLowerCase() === x.toLowerCase());
    if (el) return base.length + 1 + l.length + el.length;
  }
  return 0;
}
export function objetDuButin(texte, glossaire = [], elements = []) {
  const t = String(texte ?? '');
  const objets = [...glossaire].filter((g) => g.nom).sort((a, b) => b.nom.length - a.nom.length);
  for (const objet of objets) {
    const nom = sansLigature(objet.nom);
    // la longueur du nom dans la case (une ligature y vaut une ou deux lettres)
    for (let k = Math.max(1, nom.length - 3); k <= Math.min(t.length, nom.length + 3); k += 1) {
      if (sansLigature(t.slice(0, k)) === nom && SUFFIXE_DU_BUTIN.test(t.slice(k))) return { objet, ecrit: t.slice(0, k), reste: t.slice(k) };
    }
  }
  // avec son élément : un objet qui vaut pour tous les éléments, un fruit avec celui de sa définition
  for (const objet of objets) {
    const fruit = elementDuFruit(objet.texte, elements);
    const base = FAMILLES_PAR_ELEMENT[objet.id] ?? (fruit ? objet.nom : null);
    if (!base) continue;
    const k = avecElement(t, base, fruit ? [fruit] : elements);
    if (k && SUFFIXE_DU_BUTIN.test(t.slice(k))) return { objet, ecrit: t.slice(0, k), reste: t.slice(k) };
  }
  return null;
}

/** Cibles d'une rubrique de défense, quand elle est UNE liste « A, B, C » de noms courts ; sinon aucune (« Varie selon la magie », tableau…). */
export function cibles(texte) {
  if (!texte || texte.includes('\n')) return [];
  const morceaux = texte.split(/\s*,\s*/).map((m) => m.trim().replace(/\.$/, '')).filter(Boolean);
  if (!morceaux.every((m) => m.length <= 30 && !/[:.;]/.test(m) && !/^(varie|variable|selon|voir|aucun|rien)/i.test(m))) return [];
  return morceaux;
}

/**
 * La magie qui va avec chaque cible d'une vulnérabilité ou d'une résistance (demande du propriétaire : « rajouter les couleurs des vulnérabilités et
 * résistances selon la couleur de la magie qui va avec ») : { cible normalisée : [noms de magie] }. Une magie se nomme elle-même (« Feu ») ; une
 * altération d'état a sa magie liée (table etat_magie : « Brûlure » -> Feu, « Surcharge Magique » -> Corruption et Arcane). Écritures du bestiaire
 * rapprochées : « Temps/Espace » (la magie liée du tableau des altérations s'écrit « Temps/ Espace ») ; « Pétrification », « Gelé », « Enragée »
 * (l'état « Pétrifié », « Gel », « Enragé »). Rien d'autre : « Frappe », « Maladie », « Contrôle mentale »… restent sans magie.
 * `magies` : [noms] ; `etats` : [{ nom, magie }] (une ligne par magie liée, dans l'ordre de leur rang).
 */
export const CIBLES_RAPPROCHEES = { 'temps-espace': 'espace-temps', petrification: 'petrifie', gele: 'gel', enragee: 'enrage' };
export function magiesDesCibles(magies = [], etats = []) {
  const table = {};
  for (const m of magies) table[normalize(m)] = [m];
  for (const e of etats) (table[normalize(e.nom)] ??= []).push(e.magie);
  for (const [forme, nom] of Object.entries(CIBLES_RAPPROCHEES)) if (table[nom] && !table[forme]) table[forme] = table[nom];
  return table;
}

/** « Santé : 70 Chakra : 0 Barrière : 0 » (une seule ligne) -> { sante, chakra, barriere } ; sinon des NULL (valeurs par EP, gardées en texte). */
export function attributs(texte) {
  const a = String(texte ?? '').match(/^Santé\s*:\s*(\d+)\s+Chakra\s*:\s*(\d+)\s+Barrière\s*:\s*(\d+)$/);
  return { sante: a ? Number(a[1]) : null, chakra: a ? Number(a[2]) : null, barriere: a ? Number(a[3]) : null };
}

/**
 * « 4 armure physique / 2 armure magique (Peau) » ou « 4 AP / 2 AM » -> { armure_physique, armure_magique } ; « 0 points d'armure / 8 résistance magique »
 * n'est pas lu (le rapprochement de ces mots avec l'armure physique et magique attend le propriétaire : docs/bestiaire.md).
 */
export function defense(texte) {
  const d = String(texte ?? '').match(/^(\d+) (?:armure physique|AP) ?\/ ?(\d+) (?:armure magique|AM)\b/i);
  return { armure_physique: d ? Number(d[1]) : null, armure_magique: d ? Number(d[2]) : null };
}

/** « 4 cases sol / 4 cases nage » -> { vitesse_sol, vitesse_nage }. */
export function vitesse(texte) {
  const v = String(texte ?? '').match(/^(\d+) cases? sol \/ (\d+) cases? nage$/i);
  return { vitesse_sol: v ? Number(v[1]) : null, vitesse_nage: v ? Number(v[2]) : null };
}

/** « F : 6 / P : 4 / V : 6 / S : 2 / I : 3 / A : 6 » (une seule ligne) -> [{ caracteristique_id, rang, valeur }] ; sinon [] (valeurs par EP). */
export function caracteristiques(texte) {
  const f = String(texte ?? '').match(/^F\s*:\s*(\d+)\s*\/\s*P\s*:\s*(\d+)\s*\/\s*V\s*:\s*(\d+)\s*\/\s*S\s*:\s*(\d+)\s*\/\s*I\s*:\s*(\d+)\s*\/\s*A\s*:\s*(\d+)$/);
  return f ? FPVSIA.map((c, k) => ({ caracteristique_id: c, rang: k + 1, valeur: Number(f[k + 1]) })) : [];
}

/**
 * Tout ce que la base tire des rubriques d'une carte ([{ rubrique, texte }], dans l'ordre) : colonnes typées de `monstre` et lignes des tables de détail
 * (`monstre_caracteristique`, `monstre_attaque`, `monstre_defense`). La première rubrique d'une clé fait foi pour les valeurs uniques ; les cibles de deux
 * rubriques de même sens se suivent. `capacites` : les capacités telles que le doc les écrit (rubrique « Capacité(s) »), que seul l'extracteur range sous
 * les capacités communes (registre tools/bestiaire/capacites.json, décision R66) ; la base n'a plus ce texte (la rubrique n'y est qu'un repère vide).
 */
export function valeursDeLaCarte(rubriques) {
  const de = (cle) => rubriques.find((r) => r.rubrique === cle)?.texte ?? '';
  return {
    ...attributs(de('attributs')),
    ...defense(de('defense')),
    ...vitesse(de('vitesse')),
    caracteristiques: caracteristiques(de('caracteristiques')),
    attaques: attaques(de('degats')),
    // un premier paragraphe sans nom n'est pas une capacité (aucun cas dans le doc)
    capacites: capacites(de('capacites'))
      .filter((c) => c.nom !== null)
      .map((c, k) => ({ ...c, rang: k + 1 })),
    defenses: SENS_DEFENSE.flatMap((sens) =>
      rubriques
        .filter((r) => r.rubrique === sens)
        .flatMap((r) => cibles(r.texte))
        .map((cible, k) => ({ sens, rang: k + 1, cible, cible_cle: normalize(cible) })),
    ),
  };
}
