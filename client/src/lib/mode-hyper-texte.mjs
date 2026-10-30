// Ce que l'effet de Mode Hyper d'une magie ou d'une race change aux valeurs de la fiche (décision R172 : « Effets de magie et de race comptés », lus dans
// les textes des onglets — mode_hyper_effet, version 'onglet_magie' et 'onglet_race', décision R13 ; pour l'Espace/Temps, l'onglet de la magie —,
// « jamais par leur nom »). Chaque écriture ci-dessous est celle d'un texte de la base ; un texte qui n'en a aucune n'est qu'affiché (« Les autres effets
// restent affichés »). Les valeurs de base du Mode Hyper (+15, +7, 10 %, 75 %…) ne sont pas lues ici : ce sont des constantes de la base
// (regle_constante `mode_hyper.*`, lib/fiche-regles.mjs).
// Sans dépendance : lu au build par lib/fiche-regles.mjs, rejoué sur tous les textes de la base par test/fiche-mode-hyper.test.mjs.

/**
 * Les écritures lues, chacune avec ce qu'elle donne : { cible, valeur?, soins? }.
 * - `am_base`, `ap_base` : « L'armure magique (AM) de base augmente de 25. » (Glace), « L'armure physique (AP) de base augmente de 10. » (Terre) ;
 * - `des_attaques` : « 1d de dégâts en plus pour toutes les attaques produites » (Humain : armes et sorts) ;
 * - `des_armes` : « 2d de dégâts physiques en plus » (Nain : les armes) ;
 * - `des_sorts` : « les dégâts et soins magiques sont augmentés de 2d » (Felfe : les sorts, `soins` : leurs soins aussi) ;
 * - `vitesse` : « +2 à la Vitesse » (Humain), « +3 Vitesse » (Jackalope) ;
 * - `armure_naturelle` : « Les AP et AM naturels s'ajoutent à toute réduction de dégâts » (Marcass : même contre une attaque qui ignore l'armure).
 */
const LECTURES = [
  [/\barmure magique \(AM\) de base augmente de (\d+)/i, (m) => ({ cible: 'am_base', valeur: Number(m[1]) })],
  [/\barmure physique \(AP\) de base augmente de (\d+)/i, (m) => ({ cible: 'ap_base', valeur: Number(m[1]) })],
  [/(?<![\p{L}\d])(\d+)\s*d de dégâts en plus pour toutes les attaques\b/iu, (m) => ({ cible: 'des_attaques', valeur: Number(m[1]) })],
  [/(?<![\p{L}\d])(\d+)\s*d de dégâts physiques en plus\b/iu, (m) => ({ cible: 'des_armes', valeur: Number(m[1]) })],
  [/\bles dégâts et soins magiques sont augmentés de (\d+)\s*d(?![\p{L}\d])/iu, (m) => ({ cible: 'des_sorts', valeur: Number(m[1]), soins: true })],
  [/\+(\d+)\s+(?:à la\s+|en\s+)?vitesse(?!\p{L})/iu, (m) => ({ cible: 'vitesse', valeur: Number(m[1]) })],
  [/\bLes AP et AM naturels s['’]ajoutent à toute réduction de dégâts\b/i, () => ({ cible: 'armure_naturelle' })],
];

/** Ce que change l'effet de Mode Hyper écrit `texte` (une magie, une race) : [{ cible, valeur?, soins? }], vide pour un effet seulement affiché. */
export function effetsDuModeHyper(texte) {
  const t = String(texte ?? '').replace(/\s+/g, ' ').trim();
  const lus = [];
  for (const [re, lire] of LECTURES) {
    const m = re.exec(t);
    if (m) lus.push(lire(m));
  }
  return lus;
}

/**
 * L'armure naturelle qu'écrit un don de race ou d'ethnie (décision R172 : « Les AP et AM naturels » du Marcass, « Oui, le compter » — le don d'ethnie
 * « - +2 Armure magique (+2 tous les 5 niveaux) » en fait partie) : [{ cle: 'ap' | 'am', base, pas, niveaux }] (pas et niveaux à 0 sans progression),
 * vide sans une telle écriture. La progression se compte comme R110 : base + pas × ⌊niveau global ÷ niveaux⌋ (+2, puis +4 au niveau 5, +6 au 10) ;
 * toujours comptée dans l'armure de base (décision R177 : « Oui, toujours » ; lib/fiche-moteur.mjs#armureDesDonsDeRace).
 */
export function armureNaturelleEcrite(texte) {
  const lus = [];
  const re = /(?<![\p{L}\d])\+(\d+)\s*Armure (magique|physique)(?:\s*\(\s*\+(\d+) tous les (\d+) niveaux(?: globaux)?\s*\))?/giu;
  for (const m of String(texte ?? '').matchAll(re)) {
    lus.push({ cle: m[2].toLowerCase() === 'magique' ? 'am' : 'ap', base: Number(m[1]), pas: Number(m[3] ?? 0), niveaux: Number(m[4] ?? 0) });
  }
  return lus;
}
