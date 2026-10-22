// Couleur d'une potion (sous-onglet Consommables de l'onglet « Ceinture » de la page /ressources/equipement/) : une RÈGLE du site, jamais une couleur
// relevée ligne par ligne (demande du propriétaire du 2026-10-22 : « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de règle il
// ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. » ; puis, pour le texte : « Privilégé la lisibilité. »).
//
// La règle est un CHOIX DU SITE, inspiré des gammes du Google Doc « Alchimie » (lu le 2026-10-16 sur l'original : chaque fiole y a sa teinte, ses
// paliers du clair au foncé ; le Doc ne suit pas une règle unique, voir docs/content-guide.md, « Ceinture ») : une teinte par AFFINITÉ DE L'ESSENCE de la
// potion, déclinée selon son NIVEAU D'ALCHIMIE. Ici :
//   1. la base est la couleur de l'affinité de l'essence de la potion (`recette_ingredient`, rôle « essence », de la première variante de sa recette) :
//      - un attribut a la couleur du site (lib/attributs-couleurs.mjs : santé, chakra, barrière, corruption, 4ᵉ barre) ;
//      - une magie, la couleur de la magie sur le site (sort-format.mjs) ;
//      - une autre affinité, la couleur que le site lui ajoute (COULEURS_DES_AFFINITES), d'après le Doc : la teinte de la fiole de cette affinité au
//        palier Super (niveau Avancé, le milieu de sa gamme) ;
//      - l'affinité Démon, essence de tous les philtres, n'a pas de fiole dans le Doc : un philtre prend la couleur de la caractéristique que nomment les
//        effets de sa page (« compétences de Force » ; l'Ultime, « +1 Force », la reçoit de sa page : lib/ceinture-db.mjs ;
//        lib/caracteristiques-postures.mjs) ;
//      - l'affinité Anti (Huile rage, Remède enragé) n'a pas de couleur dans le Doc : la ligne reste neutre ;
//   2. la nuance du niveau est calculée depuis la base (NUANCES_DES_NIVEAUX : mêlée de blanc pour Novice et Apprenti, la base à Avancé, mêlée de noir pour
//      Expert et Maître ; parts choisies par le site) ;
//   3. le texte est le plus lisible sur le fond (sort-format.mjs#texteSurCouleur) ; un fond qui n'atteint pas un contraste de 4,5:1 avec lui (seuil
//      AA du WCAG) est éclairci (texte foncé) ou assombri (texte blanc) jusqu'à l'atteindre (`lisible`).
// Repère visuel sans valeur de règle du jeu. Une potion dont le niveau ou l'effet change sur le site de dev suit la même règle à la construction
// suivante du site (l'éditeur réécrit les cases de la ligne, pas sa classe).
// Couleurs sous forme de classes (choix du propriétaire du 2026-10-22, « Règle de calcul ») : la base d'une potion est une classe du site
// (`base` : { famille, cle }, la classe `.couleur-<famille>-<cle>` de lib/palette-css.mjs) ; la nuance du niveau et le fond lisible se calculent depuis
// elle, et la page Équipement n'émet la classe d'une combinaison (lib/palette-css.mjs#classeDePotion) que pour les potions qu'elle affiche.
// Sans dépendance (modules purs : attributs-couleurs.mjs, sort-format.mjs, caracteristiques-postures.mjs) ; importé par lib/ceinture-db.mjs,
// lib/palette-css.mjs et les tests.
import { couleurDAttribut } from './attributs-couleurs.mjs';
import { cleDeMagieConnue, couleurDeMagieConnue, texteSurCouleur } from './sort-format.mjs';
import { COULEURS_CARACTERISTIQUES } from './caracteristiques-postures.mjs';

/** L'affinité de l'essence de tous les philtres : sans fiole dans le Doc, un philtre prend la couleur de sa caractéristique. */
export const AFFINITE_DES_PHILTRES = 'demon';

/** L'attribut de la fiche (lib/attributs-couleurs.mjs) que désigne une affinité d'alchimie (`affinite.id`). */
export const ATTRIBUT_DE_L_AFFINITE = Object.freeze({ sante: 'sante', chakra: 'chakra', barriere: 'barriere', corruption: 'corruption', '4eme-barre': 'barre4' });

/**
 * Les couleurs que le site ajoute pour les affinités qui n'avaient pas de règle (ni attribut ni magie), d'après le Doc « Alchimie » : la teinte de la
 * fiole de chaque affinité au palier Super (niveau Avancé). L'Universelle suit la Fiole multicolore, que le Doc décline en gris (sa Panacée, elle, est
 * orange dans le Doc).
 */
export const COULEURS_DES_AFFINITES = Object.freeze({
  'chakra+sante': '#8e7cc3', // Fiole mauve
  'barriere+chakra': '#93c47d', // Fiole verte
  'barriere+sante': '#f6b26b', // Fiole orange
  'regeneration-sante': '#cc4125', // Fiole bordeaux
  'regeneration-chakra': '#efefef', // Fiole blanche
  coma: '#e4cb7f', // Fiole beige
  'armure-magique': '#76a5af', // Fiole cyante
  'armure-physique': '#a36627', // Fiole brune
  vitesse: '#c27ba0', // Fiole rose
  universelle: '#efefef', // Fiole multicolore
});

/**
 * La couleur du site que prend une affinité, { famille, cle } (la famille et la clé de sa classe, lib/palette-css.mjs) : son attribut
 * (`attribut`), sa magie (`magie`, le nom court de la magie) ou la couleur que le site lui ajoute (`affinite`) ; null si le site n'en a pas (Anti,
 * Démon). Une affinité qui est un attribut ou une magie garde la classe de cet attribut ou de cette magie : aucune couleur n'est recopiée.
 */
export function baseDAffinite(id) {
  if (!id) return null;
  if (Object.hasOwn(ATTRIBUT_DE_L_AFFINITE, id)) return { famille: 'attribut', cle: ATTRIBUT_DE_L_AFFINITE[id] };
  const magie = cleDeMagieConnue(id);
  if (magie) return { famille: 'magie', cle: magie };
  return Object.hasOwn(COULEURS_DES_AFFINITES, id) ? { famille: 'affinite', cle: id } : null;
}

/** La couleur (« #rrggbb ») d'une base de potion ({ famille, cle }), lue dans le module de sa règle ; null si la règle n'en a pas. */
function couleurDeLaBase(base) {
  if (!base) return null;
  if (base.famille === 'attribut') return couleurDAttribut(base.cle);
  if (base.famille === 'magie') return couleurDeMagieConnue(base.cle);
  if (base.famille === 'affinite') return COULEURS_DES_AFFINITES[base.cle] ?? null;
  if (base.famille === 'caracteristique') return COULEURS_CARACTERISTIQUES[base.cle] ?? null;
  return null;
}

/** La couleur de base d'une affinité : celle de son attribut, de sa magie ou celle que le site lui donne ; null si le site n'en a pas (Anti, Démon). */
export const couleurDAffinite = (id) => couleurDeLaBase(baseDAffinite(id));

/**
 * La nuance de chaque niveau d'alchimie (`niveau_alchimie.rang` : 1 Novice … 5 Maître), inspirée des gammes du Doc : la part de blanc ou de noir mêlée à
 * la base (valeurs choisies par le site). Avancé (3) est la base elle-même.
 */
export const NUANCES_DES_NIVEAUX = Object.freeze({
  1: Object.freeze({ vers: 'blanc', part: 0.7 }),
  2: Object.freeze({ vers: 'blanc', part: 0.45 }),
  3: null,
  4: Object.freeze({ vers: 'noir', part: 0.2 }),
  5: Object.freeze({ vers: 'noir', part: 0.4 }),
});

const CIBLES = { blanc: [255, 255, 255], noir: [0, 0, 0] };
const canaux = (hex) => String(hex).slice(1).match(/.{2}/g).map((c) => parseInt(c, 16));
const versHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** La nuance d'une couleur (« #rrggbb ») au niveau `rang` : la base mêlée de blanc ou de noir (NUANCES_DES_NIVEAUX) ; la base pour un rang inconnu. */
export function nuanceDuNiveau(base, rang) {
  const n = NUANCES_DES_NIVEAUX[rang];
  if (!n) return base;
  const cible = CIBLES[n.vers];
  return versHex(canaux(base).map((c, i) => c * (1 - n.part) + cible[i] * n.part));
}

const cle = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * La caractéristique dont un effet augmente les compétences (« +5% dans toutes les compétences de Force », « compétences d' Agilité ») : son id parmi
 * `caracteristiques` ([{ id, nom }]), ou null si l'effet n'en nomme aucune. Seul le nom exact d'une caractéristique compte (rien par vraisemblance).
 */
export function caracteristiqueDesCompetences(effet, caracteristiques) {
  const m = /competences d(?:e\s+|['’]\s*)([a-z]+)/.exec(cle(effet));
  if (!m) return null;
  return caracteristiques.find((c) => cle(c.nom) === m[1])?.id ?? null;
}

/** Le contraste minimal entre le texte et le fond d'une ligne (seuil AA du WCAG pour un texte courant) : « Privilégé la lisibilité. » */
export const CONTRASTE_MINIMAL = 4.5;

const luminance = (hex) => {
  const [r, g, b] = canaux(hex).map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Le contraste entre deux couleurs (« #rrggbb »), de 1 à 21 (formule du WCAG). */
export function contraste(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Un fond lisible : le fond lui-même si son texte (texteSurCouleur) l'atteint déjà au contraste minimal, sinon éclairci (texte foncé) ou assombri (texte
 * blanc) par pas de 5 % jusqu'à l'atteindre ; le texte reste celui du fond de départ.
 */
export function lisible(fond) {
  const texte = texteSurCouleur(fond);
  const vers = luminance(texte) > luminance(fond) ? CIBLES.noir : CIBLES.blanc;
  let rgb = canaux(fond);
  let resultat = fond;
  for (let i = 0; i < 20 && contraste(resultat, texte) < CONTRASTE_MINIMAL; i++) {
    rgb = rgb.map((c, k) => c * 0.95 + vers[k] * 0.05);
    resultat = versHex(rgb);
  }
  return resultat;
}

/**
 * La couleur d'une potion, ou null (ligne neutre) : `essence`, l'affinité de son essence ; `caracteristique`, celle que nomment les effets de sa page, qui
 * ne compte que pour un philtre (essence AFFINITE_DES_PHILTRES) ; `niveau`, le rang de son niveau d'alchimie. Rend { fond, texte, base, niveau } :
 * le fond (« #rrggbb », la base nuancée au niveau puis rendue lisible), le texte le plus lisible dessus, la base ({ famille, cle } : la classe du
 * site d'où la couleur se calcule) et le niveau (null s'il manque) ; la classe de la combinaison : lib/palette-css.mjs#classeDePotion.
 */
export function couleurDePotion({ essence = null, caracteristique = null, niveau = null } = {}) {
  const base = baseDAffinite(essence)
    ?? (essence === AFFINITE_DES_PHILTRES && caracteristique && Object.hasOwn(COULEURS_CARACTERISTIQUES, caracteristique)
      ? { famille: 'caracteristique', cle: caracteristique } : null);
  if (!base) return null;
  const fond = lisible(nuanceDuNiveau(couleurDeLaBase(base), niveau));
  return { fond, texte: texteSurCouleur(fond), base, niveau: niveau ?? null };
}
