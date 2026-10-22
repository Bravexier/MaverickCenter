---
name: ui-couleurs
description: "Couleurs des caractéristiques (et de leurs compétences), des postures et des alignements (lib/caracteristiques-postures.mjs, posées en --c / --c-texte dans le guide et la fiche) et des attributs (lib/attributs-couleurs.mjs, --attribut-<clé>) ; principe « Aucune couleur en dur. ». À charger avant de lire, modifier ou relire ces couleurs ou un rendu qui les pose."
paths: ["client/src/lib/caracteristiques-postures.mjs", "client/src/lib/attributs-couleurs.mjs", "client/test/caracteristiques-postures.test.mjs", "client/test/alchimie-couleurs.test.mjs"]
user-invocable: false
---
# Couleurs des caractéristiques, compétences et postures

Les caractéristiques, leurs compétences et les postures ont chacune leur couleur (demande du propriétaire), les attributs aussi (santé rouge, barrière jaune, chakra bleu, corruption noire).

Principe (demande du propriétaire du 2026-10-22) : « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de règle il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. » ; pour le texte, « Privilégé la lisibilité. » (`sort-format.mjs#texteSurCouleur`). Une couleur se lit dans le module de sa règle, jamais recopiée dans un CSS ou un rendu ; une couleur ajoutée ne double pas une règle qui existe.

## Fichiers
- `client/src/lib/caracteristiques-postures.mjs` : `COULEURS_CARACTERISTIQUES`, `COULEURS_POSTURES`, `COULEURS_ALIGNEMENTS`, `COULEUR_NEUTRE`, `couleurDeCaracteristique`, `couleurDePosture`, `couleurDAlignement`, `styleDeCouleur`. Les clés sont les ids de la base.
- Lu aussi par `lib/fiche-regles.mjs`, `components/guide/GuideBloc.astro`, `lib/armes-rendu.mjs`, `lib/edition-rendu.mjs`, `lib/monstre-rendu.mjs`, `lib/alchimie-couleurs.mjs` (philtres).
- `client/src/lib/attributs-couleurs.mjs` : `COULEURS_DES_ATTRIBUTS` (clés de la fiche : `sante`, `barriere`, `chakra`, `corruption`, `barre4`), `couleurDAttribut`, `cssDesAttributs` (les propriétés `--attribut-<clé>` sur `:root`, posées sur chaque page par `layouts/Base.astro`), lues par `styles/fiche/fiche.css` et `styles/bestiaire/carte.css` (santé, chakra, barrière des cartes), qui ne les écrivent plus. Lu aussi par `lib/alchimie-couleurs.mjs` (potions dont l'essence est un attribut ; skill `zone-ceinture`).

## À lire
- `docs/content-guide.md`, « Les pages du guide » (puce « Les blocs tirés de la base » : les valeurs de chaque couleur).
- `docs/character-generator.md` (couleurs transmises par `regles.json`).

## Invariants
- Posées en `--c` / `--c-texte` : aplat clair, texte foncé. Dans le guide (`GuideBloc.astro`) et la fiche.
- Une compétence a la couleur de sa caractéristique.
- La fiche les reçoit par `regles.json` (`fiche-regles.mjs` : `couleur` et `texte` de chaque caractéristique) ; son script (`src/scripts/fiche.mjs`) n'importe pas le module.
- Un id inconnu reçoit `COULEUR_NEUTRE`.
- Attributs : une seule source (`attributs-couleurs.mjs`) ; `fiche.css` et `bestiaire/carte.css` lisent `var(--attribut-<clé>)` et n'écrivent aucune de ces couleurs.
- Lisibilité d'une ligne colorée : texte de `texteSurCouleur`, contraste d'au moins 4,5:1 (`lib/alchimie-couleurs.mjs#lisible`, pour les potions ; les couleurs des magies l'atteignent déjà).

## Tests
- `client/test/caracteristiques-postures.test.mjs` : couleurs demandées, une par ligne de la base, ni plus ni moins ; posture par id ou par clé ; texte foncé dans les deux thèmes ; alignements.
- `client/test/alchimie-couleurs.test.mjs` : les attributs posés par `Base.astro` (et dans les pages construites de la fiche et du bestiaire), `fiche.css` et `carte.css` sans leurs couleurs ; contraste de chaque ligne de potion et de bâton.
