// Couleurs des attributs de la fiche de personnage (demande du propriétaire : santé rouge, barrière jaune, chakra bleu, corruption noire ; la 4ᵉ barre,
// le Sang ou l'Âme d'une magie, en rouge foncé : choix du site) : la règle du site pour ces cinq attributs. Une seule source (demande du propriétaire du
// 2026-10-22 : « Partout il faut utiliser Que les couleurs du site. […] Aucune couleur en dur. ») : chaque page les reçoit en propriétés CSS
// (`--attribut-<clé>`, cssDesAttributs, posées par layouts/Base.astro), que lisent styles/fiche/fiche.css et styles/bestiaire/carte.css ; l'onglet
// Ceinture de la page Équipement en tire la couleur des potions dont l'essence est un attribut (lib/alchimie-couleurs.mjs). Repère visuel sans valeur
// de règle.
// Sans dépendance : importé au build (pages, modules de rendu, tests) et par le service (lib/ceinture-db.mjs, pour la note de version).

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
