// La palette du site en classes CSS (demande du propriétaire du 2026-10-22 : « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de
// règle il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. » ; « Privilégé la lisibilité. » ; puis, pour la
// source des couleurs : « La classe CSS du site qui va avec la couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la
// couleur du classeur. »).
//
// Choix du propriétaire (2026-10-22, questions de cadrage) :
//   - « Module JS → classe » : la valeur reste dans le module de sa règle, cette feuille en est fabriquée au build ; une page ne pose plus que la classe.
//     Ce module n'écrit aucune couleur : il les lit toutes dans les modules des règles (test/palette-css.test.mjs).
//   - « Règle de calcul » : une couleur calculée (la nuance d'une potion selon son niveau) part d'une classe du site ; la classe d'une combinaison n'est
//     émise que par la page qui l'affiche (cssDesPotions), jamais écrite à la main.
//   - « Garder séparées » : chaque couleur garde son nom et sa classe, même quand deux règles ont la même valeur ; mais une affinité qui EST un attribut
//     ou une magie reste la classe de cet attribut ou de cette magie (aucune recopie : lib/alchimie-couleurs.mjs#baseDAffinite).
//   - « Thème reste, Debug à part » : les variables du thème (styles/global/base.css) ne sont pas ici ; la page Debug et l'impression ne changent pas.
//
// Une classe = `.couleur-<famille>-<id>`, qui pose `--couleur` (le fond) et `--couleur-texte` (le texte le plus lisible dessus,
// sort-format.mjs#texteSurCouleur). Les familles (FAMILLES_DE_LA_PALETTE) :
//   - magie : sort-format.mjs#COULEURS_DES_MAGIES, id = le nom court normalisé de la magie (« feu », « espace-temps »), plus `par-defaut`
//     (COULEUR_PAR_DEFAUT, la couleur d'une magie inconnue) ;
//   - attribut : lib/attributs-couleurs.mjs (sante, barriere, chakra, corruption, barre4) ;
//   - caracteristique : lib/caracteristiques-postures.mjs#COULEURS_CARACTERISTIQUES (id de la base : force, volonte…) ;
//   - affinite : lib/alchimie-couleurs.mjs#COULEURS_DES_AFFINITES, les dix affinités sans autre règle (d'après le Doc « Alchimie »).
// L'id d'une classe est la clé du module de sa règle passée par text.mjs#normalize (« chakra+sante » → « chakra-sante ») : il ne change pas quand le nom
// affiché change. Toute la palette (cssDeLaPalette) est posée sur chaque page par layouts/Base.astro.
//
// Une potion (onglet Ceinture de la page Équipement) : sa classe de combinaison `.couleur-potion-<famille>-<id>-n<rang>` (classeDePotion) pose
// `--ligne-fond` et `--ligne-texte` (la ligne colorée du gabarit commun, styles/global/tableaux.css), calculés par lib/alchimie-couleurs.mjs#couleurDePotion
// depuis la couleur de sa classe de base ; components/ceinture/CeinturePanneau.astro n'émet que celles de ses lignes (cssDesPotions).
// Sans dépendance (modules purs) : importé au build (layouts/Base.astro, composants et modules de rendu) et par les tests.
import { COULEUR_PAR_DEFAUT, COULEURS_DES_MAGIES, cleDeMagieConnue, texteSurCouleur } from './sort-format.mjs';
import { COULEURS_DES_ATTRIBUTS } from './attributs-couleurs.mjs';
import { COULEURS_CARACTERISTIQUES } from './caracteristiques-postures.mjs';
import { COULEURS_DES_AFFINITES, baseDAffinite } from './alchimie-couleurs.mjs';
import { normalize } from './text.mjs';

/** L'id de la couleur d'une magie inconnue du site (sort-format.mjs#couleurDeMagie : COULEUR_PAR_DEFAUT). */
export const MAGIE_PAR_DEFAUT = 'par-defaut';

/** Les familles de la palette : pour chacune, ses couleurs (clé du module de la règle → « #rrggbb »), lues dans le module de sa règle. */
export const FAMILLES_DE_LA_PALETTE = Object.freeze({
  magie: Object.freeze({ ...COULEURS_DES_MAGIES, [MAGIE_PAR_DEFAUT]: COULEUR_PAR_DEFAUT }),
  attribut: COULEURS_DES_ATTRIBUTS,
  caracteristique: COULEURS_CARACTERISTIQUES,
  affinite: COULEURS_DES_AFFINITES,
});

/** L'id d'une couleur dans le nom de sa classe : la clé du module de sa règle, normalisée (« chakra+sante » → « chakra-sante »). */
export const idDeCouleur = (cle) => normalize(cle ?? '');

/** La classe d'une couleur de la palette (« couleur-magie-feu »), ou null si la famille ne la connaît pas. */
export function classeDeCouleur(famille, cle) {
  const couleurs = FAMILLES_DE_LA_PALETTE[famille];
  return couleurs && Object.hasOwn(couleurs, cle) ? `couleur-${famille}-${idDeCouleur(cle)}` : null;
}

/** La classe d'une magie, d'après son nom ou son nom court (« Feu », « espace-temps ») ; celle de la couleur par défaut pour une magie inconnue. */
export const classeDeMagie = (nom) => classeDeCouleur('magie', cleDeMagieConnue(nom) ?? MAGIE_PAR_DEFAUT);

/** La classe d'un attribut de la fiche (« sante »), ou null. */
export const classeDAttribut = (cle) => classeDeCouleur('attribut', cle);

/** La classe d'une caractéristique (id de la base : « force »), ou null. */
export const classeDeCaracteristique = (id) => classeDeCouleur('caracteristique', id);

/**
 * La classe de la couleur d'une affinité d'alchimie (`affinite.id`) : celle de son attribut, de sa magie, ou celle que le site lui ajoute ; null si le
 * site n'en a pas (Anti, Démon).
 */
export function classeDAffinite(id) {
  const base = baseDAffinite(id);
  return base ? classeDeCouleur(base.famille, base.cle) : null;
}

/** Toutes les couleurs de la palette : [{ famille, cle, classe, fond, texte }], famille après famille, dans l'ordre de leur module. */
export function couleursDeLaPalette() {
  return Object.entries(FAMILLES_DE_LA_PALETTE).flatMap(([famille, couleurs]) =>
    Object.entries(couleurs).map(([cle, fond]) => ({ famille, cle, classe: classeDeCouleur(famille, cle), fond, texte: texteSurCouleur(fond) })));
}

/** La feuille de la palette : une règle par couleur, `.couleur-<famille>-<id>{--couleur:…;--couleur-texte:…}` (posée sur chaque page). */
export const cssDeLaPalette = () =>
  couleursDeLaPalette().map((c) => `.${c.classe}{--couleur:${c.fond};--couleur-texte:${c.texte}}`).join('');

/**
 * La classe de la combinaison d'une potion (`couleur` : lib/alchimie-couleurs.mjs#couleurDePotion) : sa base et son niveau,
 * « couleur-potion-attribut-sante-n1 » (n0 sans niveau) ; null pour une potion sans couleur.
 */
export function classeDePotion(couleur) {
  if (!couleur?.base || !classeDeCouleur(couleur.base.famille, couleur.base.cle)) return null;
  return `couleur-potion-${couleur.base.famille}-${idDeCouleur(couleur.base.cle)}-n${couleur.niveau ?? 0}`;
}

/**
 * La feuille des combinaisons de potions qu'une page affiche (`couleurs` : celles de ses lignes, null compris) : une règle par classe,
 * `.couleur-potion-…{--ligne-fond:…;--ligne-texte:…}`, dans l'ordre de la première ligne qui la porte.
 */
export function cssDesPotions(couleurs) {
  const regles = new Map();
  for (const c of couleurs ?? []) {
    const classe = classeDePotion(c);
    if (classe && !regles.has(classe)) regles.set(classe, `.${classe}{--ligne-fond:${c.fond};--ligne-texte:${c.texte}}`);
  }
  return [...regles.values()].join('');
}
