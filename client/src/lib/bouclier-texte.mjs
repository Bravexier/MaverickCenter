// Les effets des dons du Boxeur qui se servent du bouclier porté, lus dans leur texte (jamais par le nom du don), pour les dégâts de pugilat et la défense de
// la fiche (décisions R255 (1) à (4), R267 (1) et (3) ; mise à jour de Décembre, onglet 24 du classeur) :
//   - « Bouclier d'attaque » : « … pour infliger un dégât bonus d'AP+AM du bouclier divisé par 4 (minimum 1) » → { cle: 'extension_de_degats', diviseur: 4,
//     minimum: 1 } : (AP + AM du bouclier) ÷ 4, arrondi à l'inférieur (R269 (2), R175), au moins 1 ;
//   - « Bouragé » : « Inflige un bonus de 2 dégâts aux attaques de pugilat avec les boucliers par poids du bouclier » → { cle: 'degats_par_poids', valeur: 2 } :
//     +2 dégâts par poids du bouclier, Léger 1, Moyen 2, Lourd 3, Très lourd 4 (R255 (2), R92) ;
//   - « Égide d'assaut » : « La division pour « bouclier d'attaque » est de 3 au lieu de 4 » → { cle: 'extension_diviseur', diviseur: 3, au_lieu_de: 4 } : avec ce
//     don, Bouclier d'attaque divise par 3 (R269 (1)) ; le diviseur se lit dans le texte, et ne remplace que celui qu'il nomme (`au_lieu_de`) ;
//   - « Mur » : « Les boucliers donnent +2AP et AM » → { cle: 'defense', ap: 2, am: 2 } : le bouclier gagne +2 AP et +2 AM (R255 (4)), et toute son AP et son
//     AM s'ajoutent à la défense à chaque attaque subie, même sans parade partielle (R267 (1), exception à R96, R255 (1)).
// Chaque écriture se lit sur le texte entier, tel qu'écrit (normalisé) : une autre écriture ne se lit pas, rien n'est compté par vraisemblance. « Boucassant »,
// « Posture inébranlable » et « Posture d'urgence » restent un texte seul (R255 (2), (5), (6)).
// Sans dépendance : lu au build par lib/fiche-regles.mjs, calculé par lib/fiche-moteur.mjs (`effetsDeBouclierDesDons`, `extensionDeDegats` ; test/boxeur-bouclier.test.mjs).

const normaliser = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

const EXTENSION = /^permet d'utiliser son bouclier comme une extension de degats pour les pugilats pour infliger un degat bonus d'ap\+am du bouclier divise par (\d+) \(minimum (\d+)\)\.?$/;
const PAR_POIDS = /^inflige un bonus de (\d+) degats aux attaques de pugilat avec les boucliers par poids du bouclier\.?$/;
const EGIDE = /^la division pour « ?bouclier d'attaque ?» est de (\d+) au lieu de (\d+)\.?$/;
const MUR = /^les boucliers donnent \+(\d+) ?ap et am\.?$/;

/**
 * L'effet sur le bouclier que le texte d'un don écrit : { cle: 'extension_de_degats', diviseur, minimum } | { cle: 'extension_diviseur', diviseur, au_lieu_de } | { cle: 'degats_par_poids', valeur } |
 * { cle: 'defense', ap, am } ; null pour tout autre texte.
 */
export function effetDeBouclierEcrit(texte) {
  const t = normaliser(texte);
  const extension = EXTENSION.exec(t);
  if (extension && Number(extension[1]) > 0) return { cle: 'extension_de_degats', diviseur: Number(extension[1]), minimum: Number(extension[2]) };
  const parPoids = PAR_POIDS.exec(t);
  if (parPoids) return { cle: 'degats_par_poids', valeur: Number(parPoids[1]) };
  const egide = EGIDE.exec(t);
  if (egide && Number(egide[1]) > 0) return { cle: 'extension_diviseur', diviseur: Number(egide[1]), au_lieu_de: Number(egide[2]) };
  const mur = MUR.exec(t);
  if (mur) return { cle: 'defense', ap: Number(mur[1]), am: Number(mur[1]) };
  return null;
}
