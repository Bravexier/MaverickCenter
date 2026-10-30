// Ce que la posture du moment change aux valeurs de la fiche (demande du propriétaire du 2026-10-17 : « le fait de cocher une posture recalcule les
// valeurs de la fiche si besoin. Exemple : posture offensive 6 D6+4 devient alors 40 […] pour aussi bien les sorts et les armes. Neutre donne +5 % à
// toutes les compétences Social et Volonté etc. » ; décision R100). Chaque ligne du tableau des postures de la fiche (posture_effet, version 'fiche')
// se lit ici en un effet chiffré, seulement quand son écriture est l'une de celles ci-dessous ; une autre ligne n'est qu'affichée (« Intervention »,
// « Provocation »…). Ce qu'aucune ligne n'écrit vient des réponses du propriétaire du 2026-10-17, citées. La réussite critique (décision R180) : la
// ligne ne donne que la valeur ; les compétences où elle compte sont dans la base (posture_critique), jamais ici.
// Sans dépendance : lu au build par lib/fiche-regles.mjs, testé sur toutes les lignes de la base (test/fiche-postures-sorts.test.mjs).

/**
 * Les compétences d'attaque (réponse « Compétences d'attaque » du propriétaire à « Malus de 10% pour toucher une cible » de la posture Offensif : « −10
 * sur Arc, Arbalète, Arme légère, Arme lourde et Magie »).
 */
export const COMPETENCES_D_ATTAQUE = Object.freeze(['arc', 'arbalete', 'arme-legere', 'arme-lourde', 'magie']);

/** Un mot entier (les lettres accentuées comptent comme des lettres : `\\b` ne les connaît pas) : le nom quelle que soit la casse, l'initiale en majuscule. */
const mot = (nom, initiale) => {
  const autour = (x, drapeaux) => new RegExp(`(?<!\\p{L})(?:${x})(?!\\p{L})`, drapeaux);
  const parNom = autour(nom, 'iu');
  const parInitiale = autour(initiale, 'u');
  return { test: (t) => parNom.test(t) || parInitiale.test(t) };
};
/** Les caractéristiques qu'une ligne nomme par leur initiale ou leur nom (« jet de V ou S », « jet de perception »). */
const CARACTERISTIQUES = [
  ['force', mot('force', 'F')], ['agilite', mot('agilit[ée]', 'A')], ['intelligence', mot('intelligence', 'I')],
  ['perception', mot('perception', 'P')], ['social', mot('social', 'S')], ['volonte', mot('volont[ée]', 'V')],
];

const LECTURES = [
  // « +5% pour jet de V ou S » (Neutre : « à tout jet impliquant la caractéristique Social ou Volonté »), « +5% jet de perception » (Vigilance)
  [/^\+(\d+)\s*%\s*(?:pour )?jets? de (.+)$/i, (m) => {
    const ecrites = CARACTERISTIQUES.filter(([, re]) => re.test(m[2])).map(([id]) => id);
    return ecrites.length ? { cible: 'competences', caracteristiques: ecrites, valeur: Number(m[1]) } : null;
  }],
  // « +10% à la réussite » (Focus : « Peu importe le type de jet, il bénéficie d'un bonus de 10% à la réussite »)
  [/^\+(\d+)\s*%\s*à la réussite$/i, (m) => ({ cible: 'competences', toutes: true, valeur: Number(m[1]) })],
  // « Malus de 10% pour toucher une cible » (Offensif) : les compétences d'attaque (réponse du propriétaire)
  [/^Malus de (\d+)\s*% pour toucher une cible$/i, (m) => ({ cible: 'competences', competences: [...COMPETENCES_D_ATTAQUE], valeur: -Number(m[1]) })],
  // « +2 initiative » (Vigilance : « un bonus d'initiative de +2 lors du début de chaque tour »)
  [/^\+(\d+) initiative$/i, (m) => ({ cible: 'initiative', valeur: Number(m[1]) })],
  // « +2/4 niveau global AP/AM » (Défensif : « Cela augmente de +2 tous les 4 niveaux globaux ») : 2 × ⌈N ÷ 4⌉ (réponse du propriétaire « 2 × ⌈N/4⌉ »)
  [/^\+(\d+)\/(\d+) niveaux? globa(?:l|ux) AP\/AM$/i, (m) => ({ cible: 'armure', ap: true, am: true, pas: Number(m[1]), niveaux: Number(m[2]) })],
  // « Dégâts maximum » (Offensif : « 2d6+2 de dégâts en offensif fera automatiquement 14 dégâts »)
  [/^Dégâts maximum$/i, () => ({ cible: 'degats_maximum' })],
  // « Divise par 2 les dégâts infligés (division AVANT l'armure) » (Défensif)
  [/^Divise par (\d+) les dégâts infligés/i, (m) => ({ cible: 'degats_diviseur', valeur: Number(m[1]) })],
  // « Augmente la valeur des dés de dégâts/soin des sortilèges » (Focus : « augmenter d'un cran la nature des dés […] il n'y a pas plus haut que le D20 »)
  [/^Augmente la valeur des dés de dégâts\/soin des sortilèges$/i, () => ({ cible: 'cran_des_sorts', valeur: 1 })],
  // « +5 (+2/NPM) dégâts/soin avec une magie » (Symbiose : « Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas) »)
  [/^\+(\d+) \(\+(\d+)\/NPM\) dégâts\/soin avec une magie$/i, (m) => ({ cible: 'symbiose_sorts', base: Number(m[1]), pas: Number(m[2]) })],
  // « +4 (+2/NPM) à l'Armure magique » (Symbiose)
  [/^\+(\d+) \(\+(\d+)\/NPM\) à l['’]Armure magique$/i, (m) => ({ cible: 'symbiose_am', base: Number(m[1]), pas: Number(m[2]) })],
  // « Immunité à la magie de la symbiose » (Symbiose)
  [/^Immunité à la magie de la symbiose$/i, () => ({ cible: 'symbiose_immunite' })],
  // « Impossible d'utiliser les armes ou objets » (Symbiose)
  [/^Impossible d['’]utiliser les armes ou objets$/i, () => ({ cible: 'armes_inutilisables' })],
  // « Une seule magie active » (Symbiose : « 1 de ces magies doit être désactivée temporairement »)
  [/^Une seule magie active$/i, () => ({ cible: 'une_seule_magie' })],
  // « +5% à la réussite critique » (Offensif : « cette réussite critique monte à 10 ou moins ») et « +5% à la RC à la défense » (Défensif : « quand on
  // esquive ou pare une attaque ») : un bonus de réussite critique (décision R180), sur les compétences (posture, 'posture') de la table posture_critique
  [/^\+(\d+)\s*%\s*à la (?:réussite critique|RC)(?: (?:à la|avec une) défense)?$/i, (m) => ({ cible: 'critique', valeur: Number(m[1]) })],
];

/** L'effet chiffré qu'écrit une ligne du tableau des postures de la fiche, ou null (la ligne n'est qu'affichée). */
export function effetDePosture(texte) {
  const t = String(texte ?? '').replace(/\s+/g, ' ').trim();
  for (const [re, lire] of LECTURES) {
    const m = re.exec(t);
    if (m) return lire(m);
  }
  return null;
}
