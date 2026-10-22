// Couleurs des attributs (demande du propriétaire, fiche de personnage : « santé rouge, barrière jaune, chakra bleu, corruption noire ») : la règle du
// site pour la santé, la barrière, le chakra, la corruption et la 4ᵉ barre (le Sang ou l'Âme d'une magie). Une seule source (demande du propriétaire du
// 2026-10-22 : « Partout il faut utiliser Que les couleurs du site. […] Aucune couleur en dur ») : la fiche les pose en propriétés CSS
// (`--attribut-<clé>`, cssDesAttributs, src/pages/fiche/index.astro ; styles/fiche/fiche.css les lit), l'onglet Ceinture de la page Équipement en tire
// la couleur des potions dont l'essence est un attribut (lib/alchimie-couleurs.mjs). Repère visuel sans valeur de règle.
// Sans dépendance : importé au build seulement (pages, modules de rendu, tests).

/** La couleur de chaque attribut, clé = celle de la fiche (`data-a` des cartes d'attribut : sante, barriere, chakra, corruption, barre4). */
export const COULEURS_DES_ATTRIBUTS = Object.freeze({
  sante: '#c62828',
  barriere: '#e0b000',
  chakra: '#1e5bb8',
  corruption: '#111111',
  barre4: '#8a1c1c',
});

/** La couleur d'un attribut, ou null pour une clé inconnue. */
export const couleurDAttribut = (cle) => COULEURS_DES_ATTRIBUTS[cle] ?? null;

/** Les propriétés CSS des attributs, pour une feuille de style : « --attribut-sante: #c62828; … » (posées sur `:root` par la page qui les lit). */
export const cssDesAttributs = () => `:root { ${Object.entries(COULEURS_DES_ATTRIBUTS).map(([cle, c]) => `--attribut-${cle}: ${c};`).join(' ')} }`;
