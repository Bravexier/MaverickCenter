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
//   3. le texte est le plus lisible sur le fond (sort-format.mjs#texteSurCouleur).
// Repère visuel sans valeur de règle du jeu. Une potion dont le niveau ou l'effet change sur le site de dev suit la même règle.
// Sans dépendance (modules purs : attributs-couleurs.mjs, sort-format.mjs, caracteristiques-postures.mjs) ; importé par lib/ceinture-db.mjs et les tests.
import { couleurDAttribut } from './attributs-couleurs.mjs';
import { couleurDeMagieConnue } from './sort-format.mjs';
import { COULEURS_CARACTERISTIQUES } from './caracteristiques-postures.mjs';

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

/** La couleur de base d'une affinité : celle de son attribut, de sa magie ou celle que le site lui donne ; null si le site n'en a pas (Anti, Démon). */
export function couleurDAffinite(id) {
  if (!id) return null;
  if (Object.hasOwn(ATTRIBUT_DE_L_AFFINITE, id)) return couleurDAttribut(ATTRIBUT_DE_L_AFFINITE[id]);
  return couleurDeMagieConnue(id) ?? COULEURS_DES_AFFINITES[id] ?? null;
}

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

/**
 * La couleur d'une potion, { fond } (« #rrggbb »), ou null (ligne neutre) : `essence`, l'affinité de son essence ; `caracteristique`, celle dont elle
 * augmente les compétences (pour une essence sans couleur : les philtres, celle que nomment les effets de leur page) ; `niveau`, le rang de son niveau d'alchimie.
 */
export function couleurDePotion({ essence = null, caracteristique = null, niveau = null } = {}) {
  const base = couleurDAffinite(essence) ?? (caracteristique ? COULEURS_CARACTERISTIQUES[caracteristique] ?? null : null);
  return base ? { fond: nuanceDuNiveau(base, niveau) } : null;
}
